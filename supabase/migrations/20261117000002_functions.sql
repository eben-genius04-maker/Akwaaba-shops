-- =============================================================================
-- Migration 2 of 4: Functions and triggers
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- All SECURITY DEFINER functions use search_path = '' and fully qualified
-- names. Money is always calculated here, never trusted from the browser.
-- Payment confirmation functions are callable ONLY with the service-role key.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at       before update on public.profiles       for each row execute function public.set_updated_at();
create trigger stores_set_updated_at         before update on public.stores         for each row execute function public.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger categories_set_updated_at     before update on public.categories     for each row execute function public.set_updated_at();
create trigger products_set_updated_at       before update on public.products       for each row execute function public.set_updated_at();
create trigger store_delivery_settings_set_updated_at before update on public.store_delivery_settings for each row execute function public.set_updated_at();
create trigger delivery_zones_set_updated_at          before update on public.delivery_zones          for each row execute function public.set_updated_at();
create trigger store_payment_settings_set_updated_at  before update on public.store_payment_settings  for each row execute function public.set_updated_at();
create trigger customer_addresses_set_updated_at      before update on public.customer_addresses      for each row execute function public.set_updated_at();
create trigger orders_set_updated_at                  before update on public.orders                  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at                before update on public.payments                for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Create a profile automatically when someone signs up
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'phone'), 30), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Permission helpers used by RLS policies.
-- They only ever answer questions about the CURRENT user.
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_store_role(p_store_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_store_active(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.status = 'active'
  );
$$;

-- True when the current user and p_user_id belong to at least one common store
create or replace function public.shares_store_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members mine
    join public.store_members theirs on theirs.store_id = mine.store_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- Safe uuid cast for storage paths (returns null instead of raising)
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Protect the last owner of a store
-- -----------------------------------------------------------------------------
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other_owners integer;
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  -- The store or the user's account is being deleted: allow the cascade.
  if tg_op = 'DELETE' and (
       not exists (select 1 from public.stores s where s.id = old.store_id)
    or not exists (select 1 from public.profiles p where p.id = old.user_id)
  ) then
    return old;
  end if;

  select count(*) into v_other_owners
  from public.store_members m
  where m.store_id = old.store_id
    and m.role = 'owner'
    and m.user_id <> old.user_id;

  if v_other_owners = 0 then
    raise exception 'A store must always have at least one owner.'
      using errcode = 'P0001', hint = 'Make another member an owner first.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger store_members_protect_last_owner
  before update or delete on public.store_members
  for each row execute function public.protect_last_owner();

-- -----------------------------------------------------------------------------
-- create_store: signed-in user creates a store (status = pending).
-- The creator becomes its owner and a settings row is created.
-- -----------------------------------------------------------------------------
create or replace function public.create_store(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := (select auth.uid());
  v_store_id uuid;
  v_count    integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a store.' using errcode = '42501';
  end if;

  -- Basic abuse limit: a user can create at most 5 stores.
  select count(*) into v_count from public.stores s where s.created_by = v_user_id;
  if v_count >= 5 then
    raise exception 'Store limit reached. Contact support to create more stores.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.stores s where s.slug = lower(trim(p_slug))) then
    raise exception 'That store address is already taken.' using errcode = '23505';
  end if;

  insert into public.stores (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_user_id)
  returning id into v_store_id;

  insert into public.store_members (store_id, user_id, role)
  values (v_store_id, v_user_id, 'owner');

  insert into public.store_settings (store_id, business_name)
  values (v_store_id, trim(p_name));

  return v_store_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_store_status: platform admins approve, suspend or re-activate stores
-- -----------------------------------------------------------------------------
create or replace function public.set_store_status(
  p_store_id uuid,
  p_status   public.store_status,
  p_reason   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can change store status.'
      using errcode = '42501';
  end if;

  update public.stores s
  set status        = p_status,
      status_reason = p_reason,
      approved_at   = case when p_status = 'active' and s.approved_at is null then now() else s.approved_at end,
      approved_by   = case when p_status = 'active' and s.approved_at is null then (select auth.uid()) else s.approved_by end
  where s.id = p_store_id;

  if not found then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_invitation: show invite details on the accept page (by secret token)
-- -----------------------------------------------------------------------------
create or replace function public.get_invitation(p_token text)
returns table (
  store_name  text,
  store_slug  text,
  email       text,
  role        public.member_role,
  is_valid    boolean,
  reason      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.name,
    s.slug,
    i.email,
    i.role,
    (i.accepted_at is null and i.revoked_at is null and i.expires_at > now()),
    case
      when i.revoked_at  is not null then 'revoked'
      when i.accepted_at is not null then 'already_accepted'
      when i.expires_at <= now()     then 'expired'
      else null
    end
  from public.store_invitations i
  join public.stores s on s.id = i.store_id
  where i.token = p_token;
$$;

-- -----------------------------------------------------------------------------
-- accept_invitation: the signed-in invitee joins the store.
-- Their account email must match the invited email.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email   text := lower((select auth.jwt()) ->> 'email');
  v_inv     public.store_invitations;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to accept an invitation.' using errcode = '42501';
  end if;

  select * into v_inv
  from public.store_invitations i
  where i.token = p_token
  for update;

  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'This invitation has been cancelled.' using errcode = 'P0001';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired. Ask the store owner for a new one.' using errcode = 'P0001';
  end if;
  if v_email is null or v_email <> lower(v_inv.email) then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
  end if;

  -- Existing members keep their current role.
  insert into public.store_members (store_id, user_id, role)
  values (v_inv.store_id, v_user_id, v_inv.role)
  on conflict (store_id, user_id) do nothing;

  update public.store_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_inv.id;

  return v_inv.store_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Settings rows for each new store
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.store_delivery_settings (store_id) values (new.id) on conflict do nothing;
  insert into public.store_payment_settings  (store_id) values (new.id) on conflict do nothing;
  insert into public.store_counters          (store_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_store_created
  after insert on public.stores
  for each row execute function public.handle_new_store();

-- =============================================================================
-- 6. Internal helpers (not callable from the app)
-- =============================================================================

-- Great-circle distance in km
create or replace function public._haversine_km(lat1 double precision, lng1 double precision,
                                                lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Validates cart shape and prices it from the database.
-- Returns { issues: [...], lines: [...], subtotal, max_size }
create or replace function public._price_cart(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart must contain between 1 and 50 items.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or public.try_uuid(e ->> 'product_id') is null
       or coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,3}$'
       or (e ->> 'quantity')::int < 1
  ) then
    raise exception 'Invalid cart item.' using errcode = '22023';
  end if;

  with requested as (
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::int) as quantity,
           min(ord) as position
    from jsonb_array_elements(p_items) with ordinality as t(e, ord)
    group by 1
  ),
  priced as (
    select r.product_id, r.quantity, r.position,
           p.name, p.price, p.stock_quantity, p.delivery_size,
           (select pi.image_url from public.product_images pi
             where pi.product_id = p.id
             order by pi.is_primary desc, pi.sort_order
             limit 1) as image_url,
           case
             when p.id is null or not p.is_active then 'not_found'
             when not p.is_available               then 'unavailable'
             when p.stock_quantity = 0             then 'out_of_stock'
             when r.quantity > p.stock_quantity    then 'insufficient_stock'
             else null
           end as problem
    from requested r
    left join public.products p
      on p.id = r.product_id and p.store_id = p_store_id
  )
  select jsonb_build_object(
    'issues', coalesce(jsonb_agg(jsonb_build_object(
        'product_id', product_id,
        'name',       case when problem = 'not_found' then null else name end,
        'problem',    problem,
        'available',  case when problem = 'insufficient_stock' then stock_quantity end
      ) order by position) filter (where problem is not null), '[]'::jsonb),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'product_id',    product_id,
        'name',          name,
        'image_url',     image_url,
        'quantity',      quantity,
        'unit_price',    price,
        'subtotal',      price * quantity,
        'delivery_size', delivery_size
      ) order by position) filter (where problem is null), '[]'::jsonb),
    'subtotal', coalesce(sum(price * quantity) filter (where problem is null), 0),
    'max_size', coalesce((array['small', 'medium', 'large'])[max(
        case delivery_size when 'large' then 3 when 'medium' then 2 else 1 end
      ) filter (where problem is null)], 'small')
  )
  into v_result
  from priced;

  return v_result;
end;
$$;

-- Calculates the delivery fee.
-- Returns { ok, fee, method, zone_id, zone_name, distance_km, free_delivery, surcharge }
--      or { ok: false, error }   error: delivery_unavailable | store_not_configured
--                                       | zone_required | invalid_zone
--                                       | location_required | out_of_range
create or replace function public._delivery_fee(
  p_store_id uuid,
  p_subtotal numeric,
  p_max_size text,
  p_zone_id  uuid,
  p_lat      double precision,
  p_lng      double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s           public.store_delivery_settings;
  z           public.delivery_zones;
  v_base      numeric;
  v_distance  numeric;
  v_surcharge numeric;
  v_fee       numeric;
  v_free      boolean := false;
begin
  select * into s from public.store_delivery_settings where store_id = p_store_id;
  if not found or not s.delivery_enabled then
    return jsonb_build_object('ok', false, 'error', 'delivery_unavailable');
  end if;

  if s.method = 'zones' then
    if not exists (select 1 from public.delivery_zones dz where dz.store_id = p_store_id and dz.is_active) then
      return jsonb_build_object('ok', false, 'error', 'store_not_configured');
    end if;
    if p_zone_id is null then
      return jsonb_build_object('ok', false, 'error', 'zone_required');
    end if;
    select * into z from public.delivery_zones dz
    where dz.id = p_zone_id and dz.store_id = p_store_id and dz.is_active;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_zone');
    end if;
    v_base := z.fee;
  else
    if s.pickup_lat is null or s.pickup_lng is null then
      return jsonb_build_object('ok', false, 'error', 'store_not_configured');
    end if;
    if p_lat is null or p_lng is null then
      return jsonb_build_object('ok', false, 'error', 'location_required');
    end if;
    v_distance := round((public._haversine_km(s.pickup_lat, s.pickup_lng, p_lat, p_lng) * s.road_factor)::numeric, 1);
    if s.max_distance_km is not null and v_distance > s.max_distance_km then
      return jsonb_build_object('ok', false, 'error', 'out_of_range',
                                'distance_km', v_distance, 'max_distance_km', s.max_distance_km);
    end if;
    v_base := s.base_fee + s.per_km_fee * v_distance;
  end if;

  v_surcharge := case p_max_size
                   when 'large'  then s.large_surcharge
                   when 'medium' then s.medium_surcharge
                   else 0
                 end;

  -- Round up to whole cedis
  v_fee := ceil(v_base + v_surcharge);

  if s.free_delivery_min is not null and p_subtotal >= s.free_delivery_min then
    v_fee  := 0;
    v_free := true;
  end if;

  return jsonb_build_object(
    'ok',            true,
    'fee',           v_fee,
    'method',        s.method,
    'zone_id',       z.id,
    'zone_name',     z.name,
    'distance_km',   v_distance,
    'surcharge',     v_surcharge,
    'free_delivery', v_free
  );
end;
$$;

-- Puts an order's items back into stock (once)
create or replace function public._restore_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products p
  set stock_quantity = p.stock_quantity + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id
    and p.id = oi.product_id
    and exists (select 1 from public.orders o where o.id = p_order_id and not o.stock_restored);

  update public.orders set stock_restored = true where id = p_order_id;
end;
$$;

-- =============================================================================
-- 7. Storefront functions (public)
-- =============================================================================

-- Everything the checkout page needs to know about a store
create or replace function public.get_checkout_config(p_store_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'store_id',      st.id,
    'business_name', ss.business_name,
    'currency',      ss.currency,
    'whatsapp_number', ss.whatsapp_number,
    'delivery', jsonb_build_object(
      'enabled',           d.delivery_enabled and (
                             (d.method = 'zones' and exists (select 1 from public.delivery_zones z where z.store_id = st.id and z.is_active))
                             or (d.method = 'distance' and d.pickup_lat is not null)
                           ),
      'method',            d.method,
      'free_delivery_min', d.free_delivery_min,
      'max_distance_km',   case when d.method = 'distance' then d.max_distance_km end,
      'note',              d.delivery_note,
      'zones', case when d.method = 'zones' then coalesce((
          select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'description', z.description, 'fee', z.fee)
                           order by z.sort_order, z.name)
          from public.delivery_zones z where z.store_id = st.id and z.is_active
        ), '[]'::jsonb) end
    ),
    'payment', jsonb_build_object(
      'pay_on_delivery', p.cod_enabled,
      'cod_max_amount',  p.cod_max_amount,
      'prepaid',         p.prepaid_enabled and p.paystack_subaccount_code is not null
    )
  )
  from public.stores st
  join public.store_settings ss          on ss.store_id = st.id
  join public.store_delivery_settings d  on d.store_id = st.id
  join public.store_payment_settings p   on p.store_id = st.id
  where st.slug = lower(trim(p_store_slug)) and st.status = 'active';
$$;

-- Live price + delivery fee preview as the customer fills in checkout
create or replace function public.get_delivery_quote(
  p_store_slug text,
  p_items      jsonb,
  p_zone_id    uuid default null,
  p_lat        double precision default null,
  p_lng        double precision default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_cart     jsonb;
  v_fee      jsonb;
  v_subtotal numeric;
begin
  select s.id into v_store_id from public.stores s
  where s.slug = lower(trim(p_store_slug)) and s.status = 'active';
  if v_store_id is null then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;

  v_cart := public._price_cart(v_store_id, p_items);
  if jsonb_array_length(v_cart -> 'issues') > 0 then
    return jsonb_build_object('ok', false, 'issues', v_cart -> 'issues');
  end if;

  v_subtotal := (v_cart ->> 'subtotal')::numeric;
  v_fee := public._delivery_fee(v_store_id, v_subtotal, v_cart ->> 'max_size', p_zone_id, p_lat, p_lng);

  if not (v_fee ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'delivery_error', v_fee ->> 'error', 'subtotal', v_subtotal, 'detail', v_fee);
  end if;

  return jsonb_build_object(
    'ok',       true,
    'items',    v_cart -> 'lines',
    'subtotal', v_subtotal,
    'delivery', v_fee,
    'delivery_fee', (v_fee ->> 'fee')::numeric,
    'total',    v_subtotal + (v_fee ->> 'fee')::numeric
  );
end;
$$;

-- Places the order. Locks and reduces stock in the same transaction.
--
-- p_customer: { name, phone (233XXXXXXXXX), email }
-- p_delivery: { zone_id, lat, lng, digital_address, landmark, area, city }
-- p_items:    [{ product_id, quantity }]
--
-- Returns { ok: true, order_id, order_number, tracking_token, subtotal,
--           delivery_fee, total, currency, payment_method, needs_payment }
--      or { ok: false, issues | delivery_error | error }
create or replace function public.place_order(
  p_store_slug     text,
  p_items          jsonb,
  p_customer       jsonb,
  p_delivery       jsonb,
  p_payment_method public.payment_method,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store     public.stores;
  v_pay       public.store_payment_settings;
  v_currency  text;
  v_name      text := trim(p_customer ->> 'name');
  v_phone     text := trim(p_customer ->> 'phone');
  v_email     text := nullif(lower(trim(p_customer ->> 'email')), '');
  v_digital   text := nullif(upper(trim(p_delivery ->> 'digital_address')), '');
  v_landmark  text := nullif(trim(p_delivery ->> 'landmark'), '');
  v_zone_id   uuid := public.try_uuid(p_delivery ->> 'zone_id');
  v_lat       double precision;
  v_lng       double precision;
  v_cart      jsonb;
  v_fee       jsonb;
  v_subtotal  numeric(12, 2);
  v_fee_amt   numeric(12, 2);
  v_total     numeric(12, 2);
  v_open      integer;
  v_number    integer;
  v_order_id  uuid;
  v_token     text;
begin
  -- Store
  select * into v_store from public.stores s
  where s.slug = lower(trim(p_store_slug)) and s.status = 'active';
  if not found then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;
  select * into v_pay from public.store_payment_settings where store_id = v_store.id;
  select currency into v_currency from public.store_settings where store_id = v_store.id;

  -- Payment method allowed?
  if p_payment_method = 'pay_on_delivery' and not v_pay.cod_enabled then
    raise exception 'This store does not accept payment on delivery.' using errcode = 'P0001';
  end if;
  if p_payment_method = 'prepaid' and not (v_pay.prepaid_enabled and v_pay.paystack_subaccount_code is not null) then
    raise exception 'This store does not accept online payment yet.' using errcode = 'P0001';
  end if;

  -- Customer details
  if v_name is null or char_length(v_name) not between 2 and 100 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^233[0-9]{9}$' then
    raise exception 'Please enter a valid Ghana phone number.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if p_payment_method = 'prepaid' and v_email is null then
    raise exception 'An email address is required for online payment.' using errcode = '22023';
  end if;

  -- Delivery details
  if v_digital is not null and v_digital !~ '^[A-Z]{2}-[0-9]{3,4}-[0-9]{4}$' then
    raise exception 'Digital address should look like GA-123-4567.' using errcode = '22023';
  end if;
  if v_digital is null and coalesce(char_length(v_landmark), 0) < 5 then
    raise exception 'Please add your digital address or directions for the rider.' using errcode = '22023';
  end if;
  begin
    v_lat := nullif(p_delivery ->> 'lat', '')::double precision;
    v_lng := nullif(p_delivery ->> 'lng', '')::double precision;
  exception when others then
    raise exception 'Invalid location.' using errcode = '22023';
  end;
  if (v_lat is null) <> (v_lng is null)
     or (v_lat is not null and (v_lat not between 4.5 and 11.5 or v_lng not between -3.5 and 1.5)) then
    raise exception 'Delivery location must be in Ghana.' using errcode = '22023';
  end if;

  -- Basic abuse limit: max 3 open orders per phone per store per day
  select count(*) into v_open from public.orders o
  where o.store_id = v_store.id and o.customer_phone = v_phone
    and o.status = 'pending' and o.created_at > now() - interval '24 hours';
  if v_open >= 3 then
    raise exception 'You already have pending orders with this store. Please wait for them to be confirmed.'
      using errcode = 'P0001';
  end if;

  -- Lock the products in this cart so two customers can't buy the last item
  perform 1 from public.products p
  where p.store_id = v_store.id
    and p.id in (select public.try_uuid(e ->> 'product_id')
                 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e)
  order by p.id
  for update;

  -- Price the cart from the database
  v_cart := public._price_cart(v_store.id, p_items);
  if jsonb_array_length(v_cart -> 'issues') > 0 then
    return jsonb_build_object('ok', false, 'issues', v_cart -> 'issues');
  end if;
  v_subtotal := (v_cart ->> 'subtotal')::numeric;

  -- Delivery fee
  v_fee := public._delivery_fee(v_store.id, v_subtotal, v_cart ->> 'max_size', v_zone_id, v_lat, v_lng);
  if not (v_fee ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'delivery_error', v_fee ->> 'error', 'detail', v_fee);
  end if;
  v_fee_amt := (v_fee ->> 'fee')::numeric;
  v_total   := v_subtotal + v_fee_amt;

  if p_payment_method = 'pay_on_delivery' and v_pay.cod_max_amount is not null and v_total > v_pay.cod_max_amount then
    return jsonb_build_object('ok', false, 'error', 'cod_limit_exceeded', 'cod_max_amount', v_pay.cod_max_amount);
  end if;

  -- Reduce stock
  update public.products p
  set stock_quantity = p.stock_quantity - (l ->> 'quantity')::int
  from jsonb_array_elements(v_cart -> 'lines') l
  where p.id = (l ->> 'product_id')::uuid;

  -- Next order number for this store
  update public.store_counters
  set last_order_number = last_order_number + 1
  where store_id = v_store.id
  returning last_order_number into v_number;

  insert into public.orders (
    store_id, order_number, customer_user_id, customer_name, customer_phone, customer_email,
    digital_address, landmark, area, city, delivery_lat, delivery_lng,
    delivery_method, delivery_zone_id, delivery_zone_name, delivery_distance_km,
    subtotal, delivery_fee, total, currency, payment_method, notes, expires_at
  ) values (
    v_store.id, v_number, (select auth.uid()), v_name, v_phone, v_email,
    v_digital, v_landmark,
    nullif(left(trim(p_delivery ->> 'area'), 100), ''),
    nullif(left(trim(p_delivery ->> 'city'), 100), ''),
    v_lat, v_lng,
    (v_fee ->> 'method')::public.delivery_method,
    public.try_uuid(v_fee ->> 'zone_id'),
    v_fee ->> 'zone_name',
    (v_fee ->> 'distance_km')::numeric,
    v_subtotal, v_fee_amt, v_total, v_currency, p_payment_method,
    nullif(left(trim(p_notes), 1000), ''),
    case when p_payment_method = 'prepaid' then now() + interval '30 minutes' end
  )
  returning id, tracking_token into v_order_id, v_token;

  insert into public.order_items (order_id, store_id, product_id, product_name, image_url,
                                  unit_price, quantity, subtotal, delivery_size)
  select v_order_id, v_store.id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'image_url',
         (l ->> 'unit_price')::numeric, (l ->> 'quantity')::int, (l ->> 'subtotal')::numeric,
         (l ->> 'delivery_size')::public.delivery_size
  from jsonb_array_elements(v_cart -> 'lines') l;

  insert into public.order_status_history (order_id, store_id, status, note, changed_by)
  values (v_order_id, v_store.id, 'pending',
          case when p_payment_method = 'prepaid' then 'Order placed. Waiting for payment.'
               else 'Order placed. Waiting for the store to confirm.' end,
          (select auth.uid()));

  return jsonb_build_object(
    'ok',             true,
    'order_id',       v_order_id,
    'order_number',   v_number,
    'tracking_token', v_token,
    'subtotal',       v_subtotal,
    'delivery_fee',   v_fee_amt,
    'total',          v_total,
    'currency',       v_currency,
    'payment_method', p_payment_method,
    'needs_payment',  p_payment_method = 'prepaid'
  );
end;
$$;

-- Tracking page (guest or account) — by secret token
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number',    o.order_number,
    'status',          o.status,
    'payment_method',  o.payment_method,
    'payment_status',  o.payment_status,
    'subtotal',        o.subtotal,
    'delivery_fee',    o.delivery_fee,
    'delivery_fee_adjusted', o.delivery_fee_adjusted,
    'total',           o.total,
    'currency',        o.currency,
    'customer_name',   o.customer_name,
    'customer_phone',  o.customer_phone,
    'digital_address', o.digital_address,
    'landmark',        o.landmark,
    'area',            o.area,
    'city',            o.city,
    'delivery_zone_name',   o.delivery_zone_name,
    'delivery_distance_km', o.delivery_distance_km,
    'notes',           o.notes,
    'cancel_reason',   o.cancel_reason,
    'expires_at',      o.expires_at,
    'created_at',      o.created_at,
    'paid_at',         o.paid_at,
    'confirmed_at',    o.confirmed_at,
    'dispatched_at',   o.dispatched_at,
    'delivered_at',    o.delivered_at,
    'cancelled_at',    o.cancelled_at,
    'store', jsonb_build_object(
      'name', ss.business_name, 'slug', s.slug, 'logo_url', ss.logo_url,
      'whatsapp_number', ss.whatsapp_number, 'contact_phone', ss.contact_phone
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'product_id', i.product_id, 'name', i.product_name, 'image_url', i.image_url,
               'unit_price', i.unit_price, 'quantity', i.quantity, 'subtotal', i.subtotal)
             order by i.product_name), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id
    ),
    'timeline', (
      select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'note', h.note, 'at', h.created_at)
             order by h.created_at, h.id), '[]'::jsonb)
      from public.order_status_history h where h.order_id = o.id
    )
  )
  from public.orders o
  join public.stores s          on s.id = o.store_id
  join public.store_settings ss on ss.store_id = o.store_id
  where o.tracking_token = p_token
    and char_length(p_token) = 64;
$$;

-- "My orders" for signed-in customers
create or replace function public.list_my_orders()
returns table (
  order_number   integer,
  store_name     text,
  store_slug     text,
  status         public.order_status,
  payment_method public.payment_method,
  payment_status public.payment_status,
  total          numeric,
  currency       text,
  item_count     bigint,
  created_at     timestamptz,
  tracking_token text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.order_number, ss.business_name, s.slug, o.status, o.payment_method,
         o.payment_status, o.total, o.currency,
         (select coalesce(sum(i.quantity), 0) from public.order_items i where i.order_id = o.id),
         o.created_at, o.tracking_token
  from public.orders o
  join public.stores s          on s.id = o.store_id
  join public.store_settings ss on ss.store_id = o.store_id
  where o.customer_user_id = (select auth.uid())
  order by o.created_at desc
  limit 200;
$$;

-- Customer cancels before the store confirms (and before paying)
create or replace function public.cancel_order_by_token(p_token text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where tracking_token = p_token for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending' or v_order.payment_status not in ('unpaid', 'failed') then
    raise exception 'This order can no longer be cancelled online. Please contact the store.' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(),
      cancel_reason = coalesce(nullif(left(trim(p_reason), 500), ''), 'Cancelled by customer'),
      expires_at = null
  where id = v_order.id;

  perform public._restore_stock(v_order.id);

  insert into public.order_status_history (order_id, store_id, status, note, changed_by)
  values (v_order.id, v_order.store_id, 'cancelled', 'Cancelled by customer', (select auth.uid()));
end;
$$;

-- =============================================================================
-- 8. Store dashboard functions
-- =============================================================================

-- Move an order through its lifecycle.
--   pending → confirmed | cancelled
--   confirmed → processing | out_for_delivery | cancelled
--   processing → out_for_delivery | cancelled
--   out_for_delivery → delivered | cancelled
-- All members can move orders forward; only owners/managers can cancel.
-- p_note is shown to the customer on the tracking page.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders;
  v_allowed public.order_status[];
  v_note    text := nullif(left(trim(p_note), 500), '');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.is_store_member(v_order.store_id) then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  v_allowed := case v_order.status
    when 'pending'          then array['confirmed', 'cancelled']::public.order_status[]
    when 'confirmed'        then array['processing', 'out_for_delivery', 'cancelled']::public.order_status[]
    when 'processing'       then array['out_for_delivery', 'cancelled']::public.order_status[]
    when 'out_for_delivery' then array['delivered', 'cancelled']::public.order_status[]
    else array[]::public.order_status[]
  end;

  if not (p_status = any (v_allowed)) then
    raise exception 'An order that is % cannot be changed to %.',
      replace(v_order.status::text, '_', ' '), replace(p_status::text, '_', ' ')
      using errcode = 'P0001';
  end if;

  if p_status = 'confirmed' and v_order.payment_method = 'prepaid' and v_order.payment_status <> 'paid' then
    raise exception 'Wait for payment before confirming a prepaid order.' using errcode = 'P0001';
  end if;

  if p_status = 'cancelled'
     and not public.has_store_role(v_order.store_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'Only owners and managers can cancel orders.' using errcode = '42501';
  end if;

  update public.orders
  set status         = p_status,
      confirmed_at   = case when p_status = 'confirmed' then now() else confirmed_at end,
      dispatched_at  = case when p_status = 'out_for_delivery' then now() else dispatched_at end,
      delivered_at   = case when p_status = 'delivered' then now() else delivered_at end,
      cancelled_at   = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancel_reason  = case when p_status = 'cancelled' then coalesce(v_note, 'Cancelled by store') else cancel_reason end,
      expires_at     = null,
      -- Pay on delivery: delivered means the money was collected
      payment_status = case when p_status = 'delivered' and payment_method = 'pay_on_delivery' then 'paid'::public.payment_status else payment_status end,
      paid_at        = case when p_status = 'delivered' and payment_method = 'pay_on_delivery' then now() else paid_at end
  where id = v_order.id;

  if p_status = 'cancelled' then
    perform public._restore_stock(v_order.id);
  end if;

  insert into public.order_status_history (order_id, store_id, status, note, changed_by)
  values (v_order.id, v_order.store_id, p_status,
          case when p_status = 'cancelled' and v_order.payment_status = 'paid'
               then concat_ws(' ', v_note, '(Refund due to customer.)')
               else v_note end,
          (select auth.uid()));
end;
$$;

-- Change the delivery fee before confirming (e.g. customer picked the wrong zone).
-- Not allowed once a payment has started or completed.
create or replace function public.adjust_delivery_fee(
  p_order_id uuid,
  p_fee      numeric,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_fee   numeric(12, 2) := round(p_fee, 2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_store_role(v_order.store_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'The delivery fee can only be changed before the order is confirmed.' using errcode = 'P0001';
  end if;
  if v_order.payment_status not in ('unpaid', 'failed') then
    raise exception 'The delivery fee cannot be changed after payment has started.' using errcode = 'P0001';
  end if;
  if v_fee is null or v_fee < 0 or v_fee > 10000 then
    raise exception 'Enter a delivery fee between 0 and 10,000.' using errcode = '22023';
  end if;

  update public.orders
  set delivery_fee = v_fee, total = subtotal + v_fee, delivery_fee_adjusted = true
  where id = v_order.id;

  insert into public.order_status_history (order_id, store_id, status, note, changed_by)
  values (v_order.id, v_order.store_id, v_order.status,
          concat_ws(' ', 'Delivery fee updated to ' || v_order.currency || ' ' || to_char(v_fee, 'FM999990.00') || '.',
                    nullif(left(trim(p_note), 300), '')),
          (select auth.uid()));
end;
$$;

-- =============================================================================
-- 9. Payment functions — SERVICE ROLE ONLY (server / Paystack webhook)
-- =============================================================================

-- Start (or restart) a Paystack payment for an order.
-- Returns what the server needs to call Paystack's initialize endpoint.
create or replace function public.begin_payment(p_tracking_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_sub   text;
  v_pct   numeric;
  v_fee   numeric(12, 2);
  v_ref   text;
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

  select paystack_subaccount_code, platform_fee_percent into v_sub, v_pct
  from public.store_payment_settings where store_id = v_order.store_id;
  v_fee := round(v_order.total * v_pct / 100, 2);
  if v_sub is null then
    raise exception 'This store cannot accept online payment right now.' using errcode = 'P0001';
  end if;

  update public.payments set status = 'abandoned'
  where order_id = v_order.id and status = 'pending';

  v_ref := 'ORD' || v_order.order_number || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.payments (order_id, store_id, reference, amount, platform_fee, currency)
  values (v_order.id, v_order.store_id, v_ref, v_order.total, v_fee, v_order.currency);

  update public.orders set payment_status = 'pending' where id = v_order.id;

  return jsonb_build_object(
    'reference',        v_ref,
    'amount_minor',     (v_order.total * 100)::bigint,   -- pesewas
    'currency',         v_order.currency,
    'email',            v_order.customer_email,
    'subaccount_code',  v_sub,
    -- Pass to Paystack as transaction_charge, with bearer = 'subaccount'
    -- so the store (not the platform) pays Paystack's processing fee.
    'platform_fee_minor', (v_fee * 100)::bigint,
    'order_id',         v_order.id,
    'order_number',     v_order.order_number
  );
end;
$$;

-- Called after the webhook signature is verified AND the transaction is
-- re-verified with Paystack's API. Idempotent: safe to call twice.
create or replace function public.confirm_payment(
  p_reference    text,
  p_amount_minor bigint,
  p_currency     text,
  p_channel      text default null,
  p_data         jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order   public.orders;
  v_note    text;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_reference');
  end if;
  if v_payment.status = 'success' then
    return jsonb_build_object('ok', true, 'already_processed', true);
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  if p_amount_minor <> (v_payment.amount * 100)::bigint or upper(p_currency) <> v_payment.currency then
    update public.payments
    set status = 'failed', failure_reason = 'amount_mismatch', provider_data = p_data
    where id = v_payment.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  update public.payments
  set status = 'success', channel = left(p_channel, 50), paid_at = now(), provider_data = p_data
  where id = v_payment.id;

  v_note := case
    when v_order.payment_status = 'paid' then 'Duplicate payment received. Refund due to customer.'
    when v_order.status = 'cancelled'    then 'Payment received after the order was cancelled. Refund due to customer.'
    else 'Payment received. Waiting for the store to confirm.'
  end;

  if v_order.payment_status <> 'paid' then
    update public.orders
    set payment_status = 'paid', paid_at = now(), expires_at = null
    where id = v_order.id;
  end if;

  insert into public.order_status_history (order_id, store_id, status, note)
  values (v_order.id, v_order.store_id, v_order.status, v_note);

  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'note', v_note);
end;
$$;

create or replace function public.fail_payment(p_reference text, p_reason text default null, p_data jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found or v_payment.status <> 'pending' then
    return;
  end if;

  update public.payments
  set status = 'failed', failure_reason = left(p_reason, 300), provider_data = p_data
  where id = v_payment.id;

  update public.orders o
  set payment_status = 'failed'
  where o.id = v_payment.order_id
    and o.payment_status = 'pending'
    and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'pending');
end;
$$;

-- Cancels prepaid orders not paid within 30 minutes and returns their stock.
-- Run every few minutes (Supabase cron or a Vercel cron job). Returns count.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_store uuid;
  v_count integer := 0;
begin
  for v_id, v_store in
    select o.id, o.store_id from public.orders o
    where o.status = 'pending'
      and o.payment_method = 'prepaid'
      and o.payment_status <> 'paid'
      and o.expires_at < now()
    for update skip locked
  loop
    update public.orders
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = 'Payment was not completed in time', expires_at = null
    where id = v_id;
    perform public._restore_stock(v_id);
    insert into public.order_status_history (order_id, store_id, status, note)
    values (v_id, v_store, 'cancelled', 'Payment was not completed in time.');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Platform admin changes one store's commission (e.g. a promo rate)
create or replace function public.set_store_platform_fee(p_store_id uuid, p_percent numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can change commission.' using errcode = '42501';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 20 then
    raise exception 'Commission must be between 0 and 20 percent.' using errcode = '22023';
  end if;
  update public.store_payment_settings set platform_fee_percent = round(p_percent, 2) where store_id = p_store_id;
  if not found then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Saves the Paystack subaccount after the server creates it with Paystack
create or replace function public.set_store_subaccount(
  p_store_id     uuid,
  p_code         text,
  p_bank_name    text,
  p_account_name text,
  p_last4        text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.store_payment_settings
  set paystack_subaccount_code = p_code,
      settlement_bank_name     = p_bank_name,
      settlement_account_name  = p_account_name,
      settlement_account_last4 = p_last4,
      subaccount_connected_at  = now()
  where store_id = p_store_id;
  if not found then
    raise exception 'Store not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- =============================================================================
-- Function permissions: nothing is callable unless granted below.
-- (Supabase grants new functions to everyone by default; undo that first.)
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

-- RLS helpers (used inside policies, so every role needs them)
grant execute on function public.is_platform_admin()                         to anon, authenticated;
grant execute on function public.is_store_member(uuid)                       to anon, authenticated;
grant execute on function public.has_store_role(uuid, public.member_role[])  to anon, authenticated;
grant execute on function public.is_store_active(uuid)                       to anon, authenticated;
grant execute on function public.shares_store_with(uuid)                     to anon, authenticated;
grant execute on function public.try_uuid(text)                              to anon, authenticated;

-- Stores, staff and platform admin
grant execute on function public.create_store(text, text)                           to authenticated;
grant execute on function public.set_store_status(uuid, public.store_status, text)  to authenticated;
grant execute on function public.set_store_platform_fee(uuid, numeric)              to authenticated;
grant execute on function public.get_invitation(text)                               to anon, authenticated;
grant execute on function public.accept_invitation(text)                            to authenticated;

-- Storefront (guests and signed-in customers)
grant execute on function public.get_checkout_config(text)                                               to anon, authenticated;
grant execute on function public.get_delivery_quote(text, jsonb, uuid, double precision, double precision) to anon, authenticated;
grant execute on function public.place_order(text, jsonb, jsonb, jsonb, public.payment_method, text)     to anon, authenticated;
grant execute on function public.get_order_by_token(text)                                                to anon, authenticated;
grant execute on function public.cancel_order_by_token(text, text)                                       to anon, authenticated;
grant execute on function public.list_my_orders()                                                        to authenticated;

-- Store dashboard
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_delivery_fee(uuid, numeric, text)             to authenticated;

-- Server only (service role key — webhook, payment start, cron)
grant execute on function public.begin_payment(text)                                  to service_role;
grant execute on function public.confirm_payment(text, bigint, text, text, jsonb)     to service_role;
grant execute on function public.fail_payment(text, text, jsonb)                      to service_role;
grant execute on function public.expire_unpaid_orders()                               to service_role;
grant execute on function public.set_store_subaccount(uuid, text, text, text, text)   to service_role;

