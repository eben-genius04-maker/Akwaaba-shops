-- =============================================================================
-- Migration 12: Phase 11 — hardening
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–11.
--
-- 1. Rate limits: a tiny counter table the server uses to slow down abuse
--    (password guessing, fake sign-ups, checkout spam). Keys are SHA-256
--    hashes made by the app, so no emails or IP addresses are stored.
-- 2. Indexes for the platform admin pages and payment look-ups.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rate limits (server only)
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text primary key check (char_length(key) between 8 and 128),
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

alter table public.rate_limits enable row level security;  -- no policies: server only
revoke all on public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

-- Counts one attempt for p_key. Returns true if it's still within p_limit per
-- p_window_seconds, false if the caller should be refused.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit.' using errcode = '22023';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  -- Now and then, clear out old counters
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
create index if not exists orders_created_idx        on public.orders (created_at desc);                 -- admin: all orders, newest first
create index if not exists orders_phone_global_idx   on public.orders (customer_phone);                  -- admin: find a customer's orders
create index if not exists payments_store_created_idx on public.payments (store_id, created_at desc);    -- store/admin payment lists
create index if not exists payments_paid_idx         on public.payments (paid_at desc) where status = 'success';  -- commission totals
create index if not exists payments_created_idx      on public.payments (created_at desc);               -- admin: all attempts
create index if not exists platform_audit_log_created_idx on public.platform_audit_log (created_at desc);
create index if not exists store_members_store_idx   on public.store_members (store_id, role);
