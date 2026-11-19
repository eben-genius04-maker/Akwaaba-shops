-- =============================================================================
-- Migration 1 of 4: Schema
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Types, tables, constraints and indexes for stores, catalogue, delivery,
-- payments, customer addresses and orders. No data, no permissions yet.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
create type public.store_status as enum ('pending', 'active', 'suspended');
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.delivery_method as enum ('zones', 'distance');
create type public.delivery_size   as enum ('small', 'medium', 'large');
create type public.order_status    as enum ('pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_method  as enum ('pay_on_delivery', 'prepaid');
create type public.payment_status  as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user (created automatically by trigger)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text check (char_length(full_name) <= 120),
  phone             text check (char_length(phone) <= 30),
  avatar_url        text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- stores: one row per business (tenant)
-- -----------------------------------------------------------------------------
create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(trim(name)) between 2 and 80),
  -- slug becomes the subdomain: kofishoes.yourplatform.com
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  status           public.store_status not null default 'pending',
  plan             text not null default 'free',
  status_reason    text check (char_length(status_reason) <= 500),
  created_by       uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,
  approved_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Subdomains that must never be given to a store
  constraint stores_slug_not_reserved check (slug not in (
    'www', 'app', 'api', 'admin', 'dashboard', 'platform', 'auth', 'login',
    'signup', 'register', 'mail', 'email', 'support', 'help', 'blog', 'docs',
    'status', 'static', 'assets', 'cdn', 'store', 'stores', 'shop', 's', 'dev',
    'staging', 'test', 'demo-admin', 'billing', 'account', 'settings'
  ))
);

create index stores_status_idx on public.stores (status);
create index stores_created_by_idx on public.stores (created_by);

-- -----------------------------------------------------------------------------
-- store_settings: public business details, 1:1 with stores
-- -----------------------------------------------------------------------------
create table public.store_settings (
  store_id         uuid primary key references public.stores (id) on delete cascade,
  business_name    text not null check (char_length(trim(business_name)) between 2 and 80),
  logo_url         text,
  description      text check (char_length(description) <= 2000),
  address          text check (char_length(address) <= 300),
  -- Digits only, international format without "+", e.g. 233241234567.
  -- The app normalises 024..., +233 24... etc. before saving.
  whatsapp_number  text check (whatsapp_number ~ '^[1-9][0-9]{9,14}$'),
  contact_phone    text check (char_length(contact_phone) <= 30),
  email            text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  currency         text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  social_links     jsonb not null default '{}'::jsonb
                   check (jsonb_typeof(social_links) = 'object'),
  hero_title       text check (char_length(hero_title) <= 120),
  hero_subtitle    text check (char_length(hero_subtitle) <= 300),
  hero_image_url   text,
  brand_color      text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- store_members: who can manage which store, and with what role
-- -----------------------------------------------------------------------------
create table public.store_members (
  store_id    uuid not null references public.stores (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.member_role not null default 'staff',
  created_at  timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index store_members_user_id_idx on public.store_members (user_id);

-- -----------------------------------------------------------------------------
-- store_invitations: owner invites staff by email; invitee accepts with token
-- -----------------------------------------------------------------------------
create table public.store_invitations (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Owners cannot be invited; ownership is only given when a store is created.
  role         public.member_role not null default 'staff' check (role <> 'owner'),
  -- 64 hex chars from two random UUIDs (~244 bits of randomness)
  token        text not null unique default (
                 replace(gen_random_uuid()::text, '-', '') ||
                 replace(gen_random_uuid()::text, '-', '')
               ),
  invited_by   uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index store_invitations_store_id_idx on public.store_invitations (store_id);
-- Only one open invitation per email per store
create unique index store_invitations_one_open_per_email
  on public.store_invitations (store_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 80),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  description  text check (char_length(description) <= 1000),
  image_url    text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, slug),
  unique (store_id, id)   -- lets products reference (store_id, category_id)
);

create index categories_store_id_idx on public.categories (store_id, sort_order);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id) on delete cascade,
  category_id     uuid,
  name            text not null check (char_length(trim(name)) between 1 and 150),
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  description     text check (char_length(description) <= 10000),
  price           numeric(12, 2) not null check (price >= 0),
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  is_available    boolean not null default true,  -- can be ordered (manual switch)
  is_featured     boolean not null default false,
  is_active       boolean not null default true,  -- visible on the storefront
  delivery_size   public.delivery_size not null default 'small',  -- for delivery surcharge
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (store_id, slug),
  unique (store_id, id),   -- lets product_images reference (store_id, product_id)
  -- A product can only use a category from the SAME store.
  -- Deleting the category clears category_id but keeps store_id.
  constraint products_category_same_store
    foreign key (store_id, category_id)
    references public.categories (store_id, id)
    on delete set null (category_id)
);

create index products_store_created_idx  on public.products (store_id, created_at desc);
create index products_store_category_idx on public.products (store_id, category_id);
create index products_store_featured_idx on public.products (store_id) where is_featured and is_active;
create index products_store_price_idx    on public.products (store_id, price);
create index products_name_trgm_idx      on public.products using gin (name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null,
  product_id    uuid not null,
  image_url     text not null,
  storage_path  text,          -- path inside the storage bucket, used for deletion
  alt_text      text check (char_length(alt_text) <= 200),
  sort_order    integer not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint product_images_product_same_store
    foreign key (store_id, product_id)
    references public.products (store_id, id)
    on delete cascade
);

create index product_images_product_idx on public.product_images (product_id, sort_order);
-- At most one primary image per product
create unique index product_images_one_primary
  on public.product_images (product_id) where is_primary;

-- -----------------------------------------------------------------------------
-- 2. Store delivery settings (owner + manager edit)
-- -----------------------------------------------------------------------------
create table public.store_delivery_settings (
  store_id           uuid primary key references public.stores (id) on delete cascade,
  delivery_enabled   boolean not null default true,
  method             public.delivery_method not null default 'zones',
  -- Pickup point (shop/warehouse). Needed for the distance method.
  -- Not shown to the public.
  pickup_address     text check (char_length(pickup_address) <= 300),
  pickup_lat         double precision check (pickup_lat between 4.5 and 11.5),
  pickup_lng         double precision check (pickup_lng between -3.5 and 1.5),
  -- Distance method: fee = base_fee + per_km_fee × road distance
  base_fee           numeric(10, 2) not null default 10  check (base_fee between 0 and 10000),
  per_km_fee         numeric(10, 2) not null default 3   check (per_km_fee between 0 and 1000),
  max_distance_km    numeric(6, 1)           default 30  check (max_distance_km > 0 and max_distance_km <= 1000),
  -- Straight-line distance × road_factor ≈ road distance
  road_factor        numeric(3, 2) not null default 1.30 check (road_factor between 1 and 2),
  -- Added once per order, based on the largest item in the cart
  medium_surcharge   numeric(10, 2) not null default 0 check (medium_surcharge between 0 and 10000),
  large_surcharge    numeric(10, 2) not null default 0 check (large_surcharge between 0 and 10000),
  -- Orders with subtotal >= this get free delivery (null = never)
  free_delivery_min  numeric(12, 2) check (free_delivery_min >= 0),
  delivery_note      text check (char_length(delivery_note) <= 500),   -- e.g. "Same-day within Accra"
  updated_at         timestamptz not null default now()
);

create table public.delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 2 and 80),   -- "Teshie / Nungua"
  description  text check (char_length(description) <= 300),                    -- "Includes Lashibi, Sakumono"
  fee          numeric(10, 2) not null check (fee between 0 and 10000),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, id)
);
create index delivery_zones_store_idx on public.delivery_zones (store_id, sort_order);

-- -----------------------------------------------------------------------------
-- 3. Store payment settings (owner only)
--    Subaccount fields are written only by the server after Paystack
--    creates the subaccount. No bank/MoMo numbers are stored, only last 4.
-- -----------------------------------------------------------------------------
create table public.store_payment_settings (
  store_id                   uuid primary key references public.stores (id) on delete cascade,
  cod_enabled                boolean not null default true,
  cod_max_amount             numeric(12, 2) check (cod_max_amount > 0),   -- null = no limit
  prepaid_enabled            boolean not null default false,
  -- Platform commission on online payments, kept by the platform's main
  -- Paystack account. Set by the platform admin, not the store.
  platform_fee_percent       numeric(5, 2) not null default 1.00 check (platform_fee_percent between 0 and 20),
  paystack_subaccount_code   text check (paystack_subaccount_code ~ '^ACCT_[A-Za-z0-9]+$'),
  settlement_bank_name       text check (char_length(settlement_bank_name) <= 100),
  settlement_account_name    text check (char_length(settlement_account_name) <= 150),
  settlement_account_last4   text check (settlement_account_last4 ~ '^[0-9]{4}$'),
  subaccount_connected_at    timestamptz,
  updated_at                 timestamptz not null default now()
);

-- Per-store order counter (#1001, #1002 …). Private: no grants.
create table public.store_counters (
  store_id           uuid primary key references public.stores (id) on delete cascade,
  last_order_number  integer not null default 1000
);



-- -----------------------------------------------------------------------------
-- 4. Customer saved addresses (any signed-in user)
-- -----------------------------------------------------------------------------
create table public.customer_addresses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  label            text not null default 'Home' check (char_length(trim(label)) between 1 and 40),
  recipient_name   text not null check (char_length(trim(recipient_name)) between 2 and 100),
  phone            text not null check (phone ~ '^233[0-9]{9}$'),
  digital_address  text check (digital_address ~ '^[A-Z]{2}-[0-9]{3,4}-[0-9]{4}$'),
  landmark         text check (char_length(landmark) <= 300),   -- directions for the rider
  area             text check (char_length(area) <= 100),       -- "Teshie"
  city             text check (char_length(city) <= 100),       -- "Accra"
  lat              double precision check (lat between 4.5 and 11.5),
  lng              double precision check (lng between -3.5 and 1.5),
  location_accuracy_m numeric(8, 1) check (location_accuracy_m >= 0),
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint customer_addresses_has_directions
    check (digital_address is not null or char_length(trim(landmark)) >= 5),
  constraint customer_addresses_lat_lng_together
    check ((lat is null) = (lng is null))
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default on public.customer_addresses (user_id) where is_default;

-- -----------------------------------------------------------------------------
-- 5. Orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  store_id              uuid not null references public.stores (id) on delete cascade,
  order_number          integer not null,
  -- Secret for the guest tracking link: /track/{tracking_token}
  tracking_token        text not null unique default (
                          replace(gen_random_uuid()::text, '-', '') ||
                          replace(gen_random_uuid()::text, '-', '')
                        ),
  customer_user_id      uuid references public.profiles (id) on delete set null,   -- null = guest
  customer_name         text not null check (char_length(trim(customer_name)) between 2 and 100),
  customer_phone        text not null check (customer_phone ~ '^233[0-9]{9}$'),
  customer_email        text check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Delivery snapshot (copied, so later address edits don't change the order)
  digital_address       text check (digital_address ~ '^[A-Z]{2}-[0-9]{3,4}-[0-9]{4}$'),
  landmark              text check (char_length(landmark) <= 300),
  area                  text check (char_length(area) <= 100),
  city                  text check (char_length(city) <= 100),
  delivery_lat          double precision check (delivery_lat between 4.5 and 11.5),
  delivery_lng          double precision check (delivery_lng between -3.5 and 1.5),
  delivery_method       public.delivery_method not null,
  delivery_zone_id      uuid,
  delivery_zone_name    text,
  delivery_distance_km  numeric(7, 1),
  -- Money
  subtotal              numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee          numeric(12, 2) not null check (delivery_fee >= 0),
  total                 numeric(12, 2) not null check (total >= 0),
  currency              text not null default 'GHS',
  delivery_fee_adjusted boolean not null default false,
  -- Status
  payment_method        public.payment_method not null,
  payment_status        public.payment_status not null default 'unpaid',
  status                public.order_status not null default 'pending',
  notes                 text check (char_length(notes) <= 1000),          -- from customer
  staff_notes           text check (char_length(staff_notes) <= 2000),    -- internal
  cancel_reason         text check (char_length(cancel_reason) <= 500),
  stock_restored        boolean not null default false,
  expires_at            timestamptz,      -- prepaid orders: pay before this or auto-cancel
  paid_at               timestamptz,
  confirmed_at          timestamptz,
  dispatched_at         timestamptz,
  delivered_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (store_id, order_number),
  unique (store_id, id),
  constraint orders_total_matches check (total = subtotal + delivery_fee)
);
create index orders_store_created_idx on public.orders (store_id, created_at desc);
create index orders_store_status_idx  on public.orders (store_id, status);
create index orders_customer_idx      on public.orders (customer_user_id, created_at desc);
create index orders_phone_idx         on public.orders (store_id, customer_phone, created_at desc);
create index orders_expiry_idx        on public.orders (expires_at) where status = 'pending' and expires_at is not null;

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null,
  store_id       uuid not null,
  product_id     uuid references public.products (id) on delete set null,
  product_name   text not null,
  image_url      text,
  unit_price     numeric(12, 2) not null check (unit_price >= 0),
  quantity       integer not null check (quantity between 1 and 999),
  subtotal       numeric(12, 2) not null check (subtotal >= 0),
  delivery_size  public.delivery_size not null default 'small',
  constraint order_items_order_same_store
    foreign key (store_id, order_id) references public.orders (store_id, id) on delete cascade
);
create index order_items_order_idx on public.order_items (order_id);

-- Timeline shown on the tracking page. "note" IS visible to the customer.
create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  store_id    uuid not null references public.stores (id) on delete cascade,
  status      public.order_status not null,
  note        text check (char_length(note) <= 500),
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  store_id        uuid not null references public.stores (id) on delete cascade,
  provider        text not null default 'paystack',
  reference       text not null unique,
  amount          numeric(12, 2) not null check (amount >= 0),
  platform_fee    numeric(12, 2) not null default 0 check (platform_fee >= 0),  -- commission on this payment
  currency        text not null default 'GHS',
  status          text not null default 'pending'
                  check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel         text,              -- mobile_money, card …
  failure_reason  text,
  provider_data   jsonb,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
