-- =============================================================================
-- Migration 10: Phase 9 — Paystack, with each store's OWN Paystack account
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–9.
--
-- How money flows
--   - Each store connects its own Paystack account (public + secret key).
--   - Customers pay into the store's Paystack account.
--   - When the store connects, the server creates a "commission" subaccount
--     INSIDE the store's Paystack account that settles to the platform's bank.
--     Every payment is split: the platform gets its commission (default 1%),
--     the store keeps the rest and pays Paystack's processing fee.
--   - paystack_subaccount_code (store_payment_settings) now holds the code of
--     that commission subaccount.
--
-- Security
--   - Secret keys are encrypted by the app server (AES-256-GCM) BEFORE they
--     reach the database; the encryption key lives only in the server's
--     environment. The table below is readable by the server (service role)
--     only — never by store owners, staff or the public.
--   - Owners see only: test/live mode, the last 4 characters of the key,
--     connection status and when the last webhook arrived.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Encrypted keys (server only)
-- -----------------------------------------------------------------------------
create table if not exists public.store_paystack_keys (
  store_id              uuid primary key references public.stores (id) on delete cascade,
  public_key            text not null check (public_key ~ '^pk_(test|live)_[A-Za-z0-9]{10,100}$'),
  secret_key_encrypted  text not null check (char_length(secret_key_encrypted) between 20 and 1000),
  mode                  text not null check (mode in ('test', 'live')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.store_paystack_keys enable row level security;   -- no policies: nobody but the server
revoke all on public.store_paystack_keys from public, anon, authenticated;
grant select, insert, update, delete on public.store_paystack_keys to service_role;

drop trigger if exists store_paystack_keys_set_updated_at on public.store_paystack_keys;
create trigger store_paystack_keys_set_updated_at before update on public.store_paystack_keys
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. What the owner can see about the connection
-- -----------------------------------------------------------------------------
alter table public.store_payment_settings
  add column if not exists paystack_mode text check (paystack_mode in ('test', 'live')),
  add column if not exists paystack_key_last4 text check (paystack_key_last4 ~ '^[A-Za-z0-9]{4}$'),
  add column if not exists paystack_status text check (paystack_status in ('connected', 'split_broken')),
  add column if not exists paystack_split_checked_at timestamptz,
  add column if not exists paystack_webhook_at timestamptz;

-- Online payments need a healthy connection (commission split in place)
create or replace function public._guard_payment_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Paystack disconnected (by the server/admin): online payments switch off
  -- with it, and pay on delivery comes back on so the store can still sell.
  if new.paystack_subaccount_code is null and old.paystack_subaccount_code is not null then
    new.prepaid_enabled := false;
    new.cod_enabled := true;
    return new;
  end if;

  if new.prepaid_enabled and not old.prepaid_enabled
     and (new.paystack_subaccount_code is null or new.paystack_status is distinct from 'connected') then
    raise exception 'Connect Paystack before turning on online payments.' using errcode = 'P0001';
  end if;

  -- The store itself changed its payment options: keep at least one way to pay
  if (new.cod_enabled is distinct from old.cod_enabled or new.prepaid_enabled is distinct from old.prepaid_enabled)
     and not new.cod_enabled
     and not (new.prepaid_enabled and new.paystack_subaccount_code is not null) then
    raise exception 'Keep at least one way for customers to pay.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Server-only functions
-- -----------------------------------------------------------------------------

-- Saves (or replaces) a store's keys after the server has checked them with
-- Paystack and created the commission subaccount.
create or replace function public.connect_store_paystack(
  p_store_id         uuid,
  p_public_key       text,
  p_secret_encrypted text,
  p_secret_last4     text,
  p_mode             text,
  p_split_code       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;
  if (p_mode = 'test') <> (p_public_key like 'pk_test_%') then
    raise exception 'Public key and mode do not match.' using errcode = '22023';
  end if;

  insert into public.store_paystack_keys (store_id, public_key, secret_key_encrypted, mode)
  values (p_store_id, p_public_key, p_secret_encrypted, p_mode)
  on conflict (store_id) do update
    set public_key = excluded.public_key,
        secret_key_encrypted = excluded.secret_key_encrypted,
        mode = excluded.mode;

  update public.store_payment_settings
  set paystack_subaccount_code  = p_split_code,
      paystack_mode             = p_mode,
      paystack_key_last4        = p_secret_last4,
      paystack_status           = 'connected',
      paystack_split_checked_at = now(),
      subaccount_connected_at   = now(),
      settlement_bank_name      = null,
      settlement_account_name   = null,
      settlement_account_last4  = null
  where store_id = p_store_id;
end;
$$;

-- Removes the keys. Online payments switch off; pay on delivery comes back on.
create or replace function public.disconnect_store_paystack(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.store_paystack_keys where store_id = p_store_id;
  update public.store_payment_settings
  set paystack_subaccount_code = null,
      paystack_mode = null,
      paystack_key_last4 = null,
      paystack_status = null,
      paystack_split_checked_at = null,
      paystack_webhook_at = null,
      subaccount_connected_at = null
  where store_id = p_store_id;
end;
$$;

-- Result of the server's regular check that the commission subaccount still
-- pays the platform. If it was changed or removed, online payments pause.
create or replace function public.set_paystack_split_status(p_store_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.store_payment_settings
    set paystack_status = 'connected', paystack_split_checked_at = now()
    where store_id = p_store_id and paystack_subaccount_code is not null;
  else
    update public.store_payment_settings
    set paystack_status = 'split_broken', paystack_split_checked_at = now(),
        prepaid_enabled = false, cod_enabled = true
    where store_id = p_store_id and paystack_subaccount_code is not null;
  end if;
end;
$$;

create or replace function public.record_paystack_webhook(p_store_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.store_payment_settings set paystack_webhook_at = now() where store_id = p_store_id;
$$;

-- The old "payouts through the platform's Paystack" connection is replaced
-- by connect_store_paystack() above.
drop function if exists public.set_store_subaccount(uuid, text, text, text, text);

-- begin_payment: same as before, plus the store id (to find its keys) and a
-- check that the connection is healthy.
create or replace function public.begin_payment(p_tracking_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders;
  v_sub    text;
  v_pct    numeric;
  v_status text;
  v_fee    numeric(12, 2);
  v_ref    text;
begin
  select * into v_order from public.orders where tracking_token = p_tracking_token for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'prepaid' then
    raise exception 'This order is pay on delivery.' using errcode = 'P0001';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'This order has already been paid.' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pending' or (v_order.expires_at is not null and v_order.expires_at < now()) then
    raise exception 'This order can no longer be paid. Please place a new order.' using errcode = 'P0001';
  end if;

  select paystack_subaccount_code, platform_fee_percent, paystack_status into v_sub, v_pct, v_status
  from public.store_payment_settings where store_id = v_order.store_id;
  if v_sub is null or v_status is distinct from 'connected'
     or not exists (select 1 from public.store_paystack_keys k where k.store_id = v_order.store_id) then
    raise exception 'This store cannot accept online payment right now.' using errcode = 'P0001';
  end if;
  v_fee := round(v_order.total * v_pct / 100, 2);

  update public.payments set status = 'abandoned'
  where order_id = v_order.id and status = 'pending';

  v_ref := 'ORD' || v_order.order_number || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.payments (order_id, store_id, reference, amount, platform_fee, currency)
  values (v_order.id, v_order.store_id, v_ref, v_order.total, v_fee, v_order.currency);

  update public.orders set payment_status = 'pending' where id = v_order.id;

  return jsonb_build_object(
    'reference',          v_ref,
    'store_id',           v_order.store_id,
    'amount_minor',       (v_order.total * 100)::bigint,   -- pesewas
    'currency',           v_order.currency,
    'email',              v_order.customer_email,
    'subaccount_code',    v_sub,
    -- The platform's commission. The app sends Paystack
    -- transaction_charge = amount - commission (kept by the store's main
    -- account) and the commission goes to the platform's subaccount.
    'platform_fee_minor', (v_fee * 100)::bigint,
    'order_id',           v_order.id,
    'order_number',       v_order.order_number,
    'expires_at',         v_order.expires_at
  );
end;
$$;

revoke execute on function public.connect_store_paystack(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.disconnect_store_paystack(uuid) from public, anon, authenticated;
revoke execute on function public.set_paystack_split_status(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.record_paystack_webhook(uuid) from public, anon, authenticated;
revoke execute on function public.begin_payment(text) from public, anon, authenticated;
grant execute on function public.connect_store_paystack(uuid, text, text, text, text, text) to service_role;
grant execute on function public.disconnect_store_paystack(uuid) to service_role;
grant execute on function public.set_paystack_split_status(uuid, boolean) to service_role;
grant execute on function public.record_paystack_webhook(uuid) to service_role;
grant execute on function public.begin_payment(text) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Cancel unpaid online orders every 5 minutes (stock goes back).
--    Uses pg_cron when available (Supabase: Database → Extensions → pg_cron).
--    The app also runs this whenever the dashboard or a tracking page loads.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('akwaaba-expire-unpaid-orders', '*/5 * * * *', 'select public.expire_unpaid_orders()');
  else
    raise notice 'pg_cron is not available here; unpaid orders are expired by the app instead.';
  end if;
exception when others then
  raise notice 'Could not schedule with pg_cron (%); unpaid orders are expired by the app instead.', sqlerrm;
end;
$$;
