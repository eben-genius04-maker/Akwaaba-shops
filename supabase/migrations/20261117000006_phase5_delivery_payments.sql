-- =============================================================================
-- Migration 6: Phase 5 — delivery and payment settings rules
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–5. Safe to run on a database that already has stores.
--
-- 1. Payment settings: a store can't switch off every way to pay, and can't
--    turn on online payments before Paystack is connected. If Paystack is
--    disconnected later, online payments go off and pay on delivery comes on.
-- 2. Delivery zones: names are unique within a store (ignoring capitals and
--    spaces), and a store can have at most 50 zones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payment settings guard
-- -----------------------------------------------------------------------------
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

  if new.prepaid_enabled and not old.prepaid_enabled and new.paystack_subaccount_code is null then
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

drop trigger if exists store_payment_settings_guard on public.store_payment_settings;
create trigger store_payment_settings_guard
  before update on public.store_payment_settings
  for each row execute function public._guard_payment_settings();

-- -----------------------------------------------------------------------------
-- 2. Delivery zones: unique names, max 50 per store
-- -----------------------------------------------------------------------------
create unique index if not exists delivery_zones_store_name_key
  on public.delivery_zones (store_id, lower(trim(name)));

create or replace function public._limit_delivery_zones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the store row so two quick inserts can't both slip past the limit
  perform 1 from public.stores where id = new.store_id for update;
  if (select count(*) from public.delivery_zones where store_id = new.store_id) >= 50 then
    raise exception 'A store can have at most 50 delivery zones.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public._limit_delivery_zones() from public, anon, authenticated;
revoke execute on function public._guard_payment_settings() from public, anon, authenticated;

drop trigger if exists delivery_zones_limit on public.delivery_zones;
create trigger delivery_zones_limit
  before insert on public.delivery_zones
  for each row execute function public._limit_delivery_zones();
