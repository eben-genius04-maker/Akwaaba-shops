-- =============================================================================
-- Migration 9: Phase 8 — orders dashboard
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–8.
--
-- Two small read-only helpers for the store dashboard. Both run with the
-- caller's permissions (SECURITY INVOKER), so row-level security applies:
-- people only ever count orders of stores they belong to.
--
-- get_order_counts(store): how many orders in each status (for the tabs)
-- get_store_sales(store):  today / last 7 days / last 30 days summary
--                          (days follow Ghana time; cancelled orders excluded)
-- =============================================================================

create or replace function public.get_order_counts(p_store_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pending',          count(*) filter (where status = 'pending'),
    'confirmed',        count(*) filter (where status = 'confirmed'),
    'processing',       count(*) filter (where status = 'processing'),
    'out_for_delivery', count(*) filter (where status = 'out_for_delivery'),
    'delivered',        count(*) filter (where status = 'delivered'),
    'cancelled',        count(*) filter (where status = 'cancelled'),
    'all',              count(*)
  )
  from public.orders
  where store_id = p_store_id;
$$;

create or replace function public.get_store_sales(p_store_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select ((now() at time zone 'Africa/Accra')::date at time zone 'Africa/Accra') as today_start
  )
  select jsonb_build_object(
    'orders_today', count(*) filter (where o.created_at >= b.today_start),
    'sales_today',  coalesce(sum(o.total) filter (where o.created_at >= b.today_start), 0),
    'orders_7d',    count(*) filter (where o.created_at >= b.today_start - interval '6 days'),
    'sales_7d',     coalesce(sum(o.total) filter (where o.created_at >= b.today_start - interval '6 days'), 0),
    'orders_30d',   count(*) filter (where o.created_at >= b.today_start - interval '29 days'),
    'sales_30d',    coalesce(sum(o.total) filter (where o.created_at >= b.today_start - interval '29 days'), 0),
    'delivered_30d', coalesce(sum(o.total) filter (where o.status = 'delivered' and o.created_at >= b.today_start - interval '29 days'), 0)
  )
  from bounds b
  left join public.orders o
    on o.store_id = p_store_id
   and o.status <> 'cancelled'
   and o.created_at >= b.today_start - interval '29 days';
$$;

revoke execute on function public.get_order_counts(uuid) from public, anon;
revoke execute on function public.get_store_sales(uuid) from public, anon;
grant execute on function public.get_order_counts(uuid) to authenticated;
grant execute on function public.get_store_sales(uuid) to authenticated;
