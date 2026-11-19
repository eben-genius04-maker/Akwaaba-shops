-- =============================================================================
-- Migration 7: Phase 6 — storefront cart
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–6.
--
-- get_cart(): prices a shopper's cart from the database (current prices,
-- stock, availability) so the cart page never trusts what the browser saved.
-- Works for live stores, and for the store's own team on a store that is
-- still waiting for approval (preview).
-- =============================================================================

create or replace function public.get_cart(p_store_slug text, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_store   public.stores;
  v_cart    jsonb;
  v_del     public.store_delivery_settings;
begin
  select * into v_store from public.stores s where s.slug = lower(trim(p_store_slug));
  if not found or not (v_store.status = 'active' or public.is_store_member(v_store.id)) then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;

  v_cart := public._price_cart(v_store.id, p_items);
  select * into v_del from public.store_delivery_settings where store_id = v_store.id;

  return v_cart || jsonb_build_object(
    'store_active',      v_store.status = 'active',
    'free_delivery_min', case when v_del.delivery_enabled then v_del.free_delivery_min end,
    'delivery_enabled',  coalesce(v_del.delivery_enabled, false)
  );
end;
$$;

revoke execute on function public.get_cart(text, jsonb) from public;
grant execute on function public.get_cart(text, jsonb) to anon, authenticated;
