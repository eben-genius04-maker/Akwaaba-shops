-- =============================================================================
-- Migration 3 of 4: Table privileges and Row Level Security
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Layer 1: GRANTs decide which operations/columns a role may use.
-- Layer 2: RLS policies decide which ROWS (which store) it may touch.
-- Roles: anon = visitor, authenticated = signed-in user.
-- Store roles come from store_members: owner > manager > staff.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Privileges — start from nothing, then grant what is needed
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Public visitors: read-only storefront data
grant select on public.stores, public.store_settings, public.categories,
               public.products, public.product_images
  to anon;

-- Signed-in users
grant select on all tables in schema public to authenticated;

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (name) on public.stores to authenticated;          -- slug/status are locked
grant update (business_name, logo_url, description, address, whatsapp_number,
              contact_phone, email, currency, social_links, hero_title,
              hero_subtitle, hero_image_url, brand_color)
  on public.store_settings to authenticated;
grant update (role), delete on public.store_members to authenticated;
grant insert (store_id, email, role, invited_by) on public.store_invitations to authenticated;
grant update (revoked_at), delete on public.store_invitations to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.stores            enable row level security;
alter table public.store_settings    enable row level security;
alter table public.store_members     enable row level security;
alter table public.store_invitations enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_images    enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: read own, teammates, or as platform admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_store_with(id)
    or public.is_platform_admin()
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- stores
-- -----------------------------------------------------------------------------
create policy "stores: public reads active stores"
  on public.stores for select to anon, authenticated
  using (status = 'active');

create policy "stores: members read their stores"
  on public.stores for select to authenticated
  using (public.is_store_member(id));

create policy "stores: platform admin reads all"
  on public.stores for select to authenticated
  using (public.is_platform_admin());

create policy "stores: owners rename"
  on public.stores for update to authenticated
  using (public.has_store_role(id, array['owner']::public.member_role[]))
  with check (public.has_store_role(id, array['owner']::public.member_role[]));

-- Stores are created via create_store() and status changes via set_store_status().

-- -----------------------------------------------------------------------------
-- store_settings
-- -----------------------------------------------------------------------------
create policy "store_settings: public reads active stores"
  on public.store_settings for select to anon, authenticated
  using (public.is_store_active(store_id));

create policy "store_settings: members read"
  on public.store_settings for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "store_settings: owners update"
  on public.store_settings for update to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- store_members
-- -----------------------------------------------------------------------------
create policy "store_members: members see their team"
  on public.store_members for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "store_members: owners change roles"
  on public.store_members for update to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner']::public.member_role[]));

create policy "store_members: owners remove members, anyone can leave"
  on public.store_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_store_role(store_id, array['owner']::public.member_role[])
  );

-- New members are only added via create_store() and accept_invitation().

-- -----------------------------------------------------------------------------
-- store_invitations (owners only; invitees use get/accept_invitation())
-- -----------------------------------------------------------------------------
create policy "store_invitations: owners read"
  on public.store_invitations for select to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]));

create policy "store_invitations: owners create"
  on public.store_invitations for insert to authenticated
  with check (
    public.has_store_role(store_id, array['owner']::public.member_role[])
    and invited_by = (select auth.uid())
  );

create policy "store_invitations: owners revoke"
  on public.store_invitations for update to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner']::public.member_role[]));

create policy "store_invitations: owners delete"
  on public.store_invitations for delete to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- categories (owner + manager manage)
-- -----------------------------------------------------------------------------
create policy "categories: public reads active categories of active stores"
  on public.categories for select to anon, authenticated
  using (is_active and public.is_store_active(store_id));

create policy "categories: members read all"
  on public.categories for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "categories: owners and managers insert"
  on public.categories for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

create policy "categories: owners and managers update"
  on public.categories for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

create policy "categories: owners and managers delete"
  on public.categories for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- products (all members create/edit; owner + manager delete)
-- -----------------------------------------------------------------------------
create policy "products: public reads active products of active stores"
  on public.products for select to anon, authenticated
  using (is_active and public.is_store_active(store_id));

create policy "products: members read all"
  on public.products for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "products: members insert"
  on public.products for insert to authenticated
  with check (public.is_store_member(store_id));

create policy "products: members update"
  on public.products for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy "products: owners and managers delete"
  on public.products for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- product_images (all members manage)
-- -----------------------------------------------------------------------------
create policy "product_images: public reads images of visible products"
  on public.product_images for select to anon, authenticated
  using (
    public.is_store_active(store_id)
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active
    )
  );

create policy "product_images: members read all"
  on public.product_images for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "product_images: members insert"
  on public.product_images for insert to authenticated
  with check (public.is_store_member(store_id));

create policy "product_images: members update"
  on public.product_images for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy "product_images: members delete"
  on public.product_images for delete to authenticated
  using (public.is_store_member(store_id));

-- =============================================================================
-- Delivery, payments, addresses and orders
-- =============================================================================
-- =============================================================================
revoke all on public.store_delivery_settings, public.delivery_zones, public.store_payment_settings,
              public.store_counters, public.customer_addresses, public.orders, public.order_items,
              public.order_status_history, public.payments
  from anon, authenticated;

grant select on public.store_delivery_settings, public.delivery_zones, public.store_payment_settings,
                public.customer_addresses, public.orders, public.order_items,
                public.order_status_history, public.payments
  to authenticated;

grant update (delivery_enabled, method, pickup_address, pickup_lat, pickup_lng, base_fee, per_km_fee,
              max_distance_km, road_factor, medium_surcharge, large_surcharge, free_delivery_min, delivery_note)
  on public.store_delivery_settings to authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
grant update (cod_enabled, cod_max_amount, prepaid_enabled) on public.store_payment_settings to authenticated;
grant insert, update, delete on public.customer_addresses to authenticated;
grant update (staff_notes) on public.orders to authenticated;

alter table public.store_delivery_settings enable row level security;
alter table public.delivery_zones          enable row level security;
alter table public.store_payment_settings  enable row level security;
alter table public.store_counters          enable row level security;
alter table public.customer_addresses      enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.order_status_history    enable row level security;
alter table public.payments                enable row level security;

-- Delivery settings & zones: members read, owner + manager edit.
-- The public sees them only through get_checkout_config().
create policy "store_delivery_settings: members read"
  on public.store_delivery_settings for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "store_delivery_settings: owners and managers update"
  on public.store_delivery_settings for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

create policy "delivery_zones: members read"
  on public.delivery_zones for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "delivery_zones: owners and managers insert"
  on public.delivery_zones for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));
create policy "delivery_zones: owners and managers update"
  on public.delivery_zones for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));
create policy "delivery_zones: owners and managers delete"
  on public.delivery_zones for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]));

-- Payment settings: owner only
create policy "store_payment_settings: owners read"
  on public.store_payment_settings for select to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]) or public.is_platform_admin());
create policy "store_payment_settings: owners update"
  on public.store_payment_settings for update to authenticated
  using (public.has_store_role(store_id, array['owner']::public.member_role[]))
  with check (public.has_store_role(store_id, array['owner']::public.member_role[]));

-- Saved addresses: only your own
create policy "customer_addresses: own"
  on public.customer_addresses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Orders: store members read and add staff notes.
-- Customers use get_order_by_token() / list_my_orders() (staff notes stay hidden).
create policy "orders: members read"
  on public.orders for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());
create policy "orders: members update staff notes"
  on public.orders for update to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create policy "order_items: members read"
  on public.order_items for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "order_status_history: members read"
  on public.order_status_history for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "payments: owners and managers read"
  on public.payments for select to authenticated
  using (public.has_store_role(store_id, array['owner', 'manager']::public.member_role[]) or public.is_platform_admin());
