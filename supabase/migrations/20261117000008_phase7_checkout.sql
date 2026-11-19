-- =============================================================================
-- Migration 8: Phase 7 — checkout: saved delivery addresses
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–7.
--
-- Also fixes the saved-address rule "digital address OR directions" (see the end).
--
-- Customers with an account can save addresses at checkout and reuse them in
-- any store. These rules keep the list tidy:
--   - at most 20 addresses per person
--   - exactly one default: the first address becomes the default, choosing a
--     new default unsets the old one, deleting the default promotes the newest
-- =============================================================================

create or replace function public._customer_address_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.customer_addresses where user_id = new.user_id) >= 20 then
      raise exception 'You can save up to 20 addresses. Delete one first.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.customer_addresses where user_id = new.user_id and is_default) then
      new.is_default := true;
    end if;
  end if;

  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.customer_addresses
    set is_default = false
    where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;

create or replace function public._customer_address_promote_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.customer_addresses
    set is_default = true
    where id = (select id from public.customer_addresses
                where user_id = old.user_id order by created_at desc limit 1);
  end if;
  return null;
end;
$$;

revoke execute on function public._customer_address_defaults() from public, anon, authenticated;
revoke execute on function public._customer_address_promote_default() from public, anon, authenticated;

drop trigger if exists customer_addresses_defaults on public.customer_addresses;
create trigger customer_addresses_defaults
  before insert or update of is_default on public.customer_addresses
  for each row execute function public._customer_address_defaults();

drop trigger if exists customer_addresses_promote_default on public.customer_addresses;
create trigger customer_addresses_promote_default
  after delete on public.customer_addresses
  for each row execute function public._customer_address_promote_default();

-- -----------------------------------------------------------------------------
-- Fix: an address with neither a digital address nor directions slipped past
-- the original check (an empty value counted as "unknown", not "false").
-- NOT VALID: checks new and edited addresses without failing on old rows.
-- -----------------------------------------------------------------------------
alter table public.customer_addresses drop constraint if exists customer_addresses_has_directions;
alter table public.customer_addresses add constraint customer_addresses_has_directions
  check (digital_address is not null or coalesce(char_length(trim(landmark)), 0) >= 5) not valid;
