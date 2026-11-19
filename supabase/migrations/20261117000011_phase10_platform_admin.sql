-- =============================================================================
-- Migration 11: Phase 10 — platform admin panel
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–10.
--
-- 1. platform_audit_log: a record of every store approval/suspension and
--    commission change (who, when, what). Read by platform admins only.
-- 2. Read-only summaries for the admin panel. Each one checks the caller is a
--    platform admin; anyone else gets "permission denied".
--
-- Make yourself an admin (SQL Editor, once):
--   update public.profiles set is_platform_admin = true where email = 'you@example.com';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Audit log
-- -----------------------------------------------------------------------------
create table if not exists public.platform_audit_log (
  id         bigint generated always as identity primary key,
  store_id   uuid references public.stores (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (action in ('store_status', 'platform_fee')),
  old_value  text,
  new_value  text,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_log_store_idx on public.platform_audit_log (store_id, created_at desc);

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from public, anon, authenticated;
grant select on public.platform_audit_log to authenticated;
grant select, insert on public.platform_audit_log to service_role;

drop policy if exists "audit log: platform admins read" on public.platform_audit_log;
create policy "audit log: platform admins read"
  on public.platform_audit_log for select to authenticated
  using (public.is_platform_admin());

create or replace function public._audit_store_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.platform_audit_log (store_id, actor_id, action, old_value, new_value, note)
    values (new.id, (select auth.uid()), 'store_status', old.status::text, new.status::text, new.status_reason);
  end if;
  return new;
end;
$$;

create or replace function public._audit_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform_fee_percent is distinct from old.platform_fee_percent then
    insert into public.platform_audit_log (store_id, actor_id, action, old_value, new_value)
    values (new.store_id, (select auth.uid()), 'platform_fee', old.platform_fee_percent::text, new.platform_fee_percent::text);
  end if;
  return new;
end;
$$;

revoke execute on function public._audit_store_status() from public, anon, authenticated;
revoke execute on function public._audit_platform_fee() from public, anon, authenticated;

drop trigger if exists stores_audit_status on public.stores;
create trigger stores_audit_status after update of status on public.stores
  for each row execute function public._audit_store_status();

drop trigger if exists store_payment_settings_audit_fee on public.store_payment_settings;
create trigger store_payment_settings_audit_fee after update of platform_fee_percent on public.store_payment_settings
  for each row execute function public._audit_platform_fee();

-- -----------------------------------------------------------------------------
-- 2. Admin summaries
-- -----------------------------------------------------------------------------
create or replace function public._require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can do this.' using errcode = '42501';
  end if;
end;
$$;

-- Whole-platform numbers for the admin overview (days follow Ghana time)
create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today timestamptz := ((now() at time zone 'Africa/Accra')::date at time zone 'Africa/Accra');
  v jsonb;
begin
  perform public._require_platform_admin();

  select jsonb_build_object(
    'stores', (select jsonb_build_object(
        'pending',   count(*) filter (where status = 'pending'),
        'active',    count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended'),
        'all',       count(*),
        'new_7d',    count(*) filter (where created_at >= v_today - interval '6 days'))
      from public.stores),
    'orders', (select jsonb_build_object(
        'today',    count(*) filter (where created_at >= v_today),
        'last_7d',  count(*) filter (where created_at >= v_today - interval '6 days'),
        'last_30d', count(*) filter (where created_at >= v_today - interval '29 days'),
        'gmv_30d',  coalesce(sum(total) filter (where created_at >= v_today - interval '29 days'), 0),
        'gmv_all',  coalesce(sum(total), 0))
      from public.orders where status <> 'cancelled'),
    'payments', (select jsonb_build_object(
        'online_30d',     coalesce(sum(amount) filter (where paid_at >= v_today - interval '29 days'), 0),
        'commission_30d', coalesce(sum(platform_fee) filter (where paid_at >= v_today - interval '29 days'), 0),
        'commission_all', coalesce(sum(platform_fee), 0),
        'count_30d',      count(*) filter (where paid_at >= v_today - interval '29 days'))
      from public.payments where status = 'success'),
    'paystack', (select jsonb_build_object(
        'live',   count(*) filter (where paystack_mode = 'live' and paystack_status = 'connected'),
        'test',   count(*) filter (where paystack_mode = 'test' and paystack_status = 'connected'),
        'broken', count(*) filter (where paystack_status = 'split_broken'))
      from public.store_payment_settings),
    'customers', (select count(*) from public.profiles p
                  where not exists (select 1 from public.store_members m where m.user_id = p.id))
  ) into v;
  return v;
end;
$$;

-- Store list with owner and activity, for the admin "Stores" page
create or replace function public.admin_list_stores(
  p_status public.store_status default null,
  p_search text default null,
  p_limit  int default 30,
  p_offset int default 0
)
returns table (
  id uuid, name text, slug text, status public.store_status, status_reason text,
  created_at timestamptz, approved_at timestamptz,
  owner_name text, owner_email text, owner_phone text,
  product_count bigint, order_count bigint, orders_30d bigint, last_order_at timestamptz,
  paystack_mode text, paystack_status text, platform_fee_percent numeric,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public._require_platform_admin();
  return query
  with base as (
    select s.*, o.full_name as o_name, o.email as o_email, o.phone as o_phone
    from public.stores s
    left join lateral (
      select pr.full_name, pr.email, pr.phone
      from public.store_members m join public.profiles pr on pr.id = m.user_id
      where m.store_id = s.id and m.role = 'owner'
      order by m.created_at limit 1
    ) o on true
    where (p_status is null or s.status = p_status)
      and (v_q is null
           or s.name ilike '%' || v_q || '%'
           or s.slug ilike '%' || v_q || '%'
           or o.email ilike '%' || v_q || '%')
  )
  select b.id, b.name, b.slug, b.status, b.status_reason, b.created_at, b.approved_at,
         b.o_name, b.o_email, b.o_phone,
         (select count(*) from public.products p where p.store_id = b.id),
         (select count(*) from public.orders od where od.store_id = b.id),
         (select count(*) from public.orders od where od.store_id = b.id and od.created_at >= now() - interval '30 days'),
         (select max(od.created_at) from public.orders od where od.store_id = b.id),
         ps.paystack_mode, ps.paystack_status, ps.platform_fee_percent,
         count(*) over ()
  from base b
  left join public.store_payment_settings ps on ps.store_id = b.id
  order by (b.status = 'pending') desc, b.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- One store's totals for the admin store page
create or replace function public.admin_store_summary(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_platform_admin();
  return jsonb_build_object(
    'orders_all',     (select count(*) from public.orders where store_id = p_store_id),
    'orders_30d',     (select count(*) from public.orders where store_id = p_store_id and created_at >= now() - interval '30 days'),
    'gmv_all',        (select coalesce(sum(total), 0) from public.orders where store_id = p_store_id and status <> 'cancelled'),
    'gmv_30d',        (select coalesce(sum(total), 0) from public.orders where store_id = p_store_id and status <> 'cancelled' and created_at >= now() - interval '30 days'),
    'cancelled_all',  (select count(*) from public.orders where store_id = p_store_id and status = 'cancelled'),
    'online_paid',    (select coalesce(sum(amount), 0) from public.payments where store_id = p_store_id and status = 'success'),
    'commission_all', (select coalesce(sum(platform_fee), 0) from public.payments where store_id = p_store_id and status = 'success'),
    'products',       (select count(*) from public.products where store_id = p_store_id),
    'products_active',(select count(*) from public.products where store_id = p_store_id and is_active),
    'members',        (select count(*) from public.store_members where store_id = p_store_id)
  );
end;
$$;

revoke execute on function public._require_platform_admin() from public, anon, authenticated;
revoke execute on function public.admin_platform_stats() from public, anon;
revoke execute on function public.admin_list_stores(public.store_status, text, int, int) from public, anon;
revoke execute on function public.admin_store_summary(uuid) from public, anon;
grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_stores(public.store_status, text, int, int) to authenticated;
grant execute on function public.admin_store_summary(uuid) to authenticated;
