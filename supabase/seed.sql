-- =============================================================================
-- OPTIONAL: Demo store for development
--
-- Run AFTER the 4 migrations and AFTER you have signed up / created your
-- user in Supabase (Authentication → Users).
--
-- 1. Replace the email below with your own account email.
-- 2. Run this whole file in the Supabase SQL Editor.
--
-- It creates an ACTIVE store at slug "demo" owned by you, with 3 categories
-- and 6 products. Safe to re-run: it does nothing if "demo" already exists.
-- =============================================================================

do $$
declare
  v_email    text := 'you@example.com';   -- <<< CHANGE THIS
  v_user_id  uuid;
  v_store_id uuid;
  v_sneakers uuid;
  v_bags     uuid;
  v_watches  uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception 'No user found with email %. Create the user first, then edit v_email.', v_email;
  end if;

  if exists (select 1 from public.stores where slug = 'demo') then
    raise notice 'Demo store already exists — nothing to do.';
    return;
  end if;

  insert into public.stores (name, slug, status, created_by, approved_at, approved_by)
  values ('Demo Store', 'demo', 'active', v_user_id, now(), v_user_id)
  returning id into v_store_id;

  insert into public.store_members (store_id, user_id, role)
  values (v_store_id, v_user_id, 'owner');

  insert into public.store_settings (
    store_id, business_name, description, address, whatsapp_number,
    contact_phone, email, hero_title, hero_subtitle, social_links
  ) values (
    v_store_id, 'Demo Store',
    'Quality shoes, bags and accessories delivered across Accra.',
    'Osu, Accra', '233200000000', '020 000 0000', 'hello@demo.store',
    'Step into something new', 'Order in seconds on WhatsApp. Delivery across Greater Accra.',
    '{"instagram": "", "facebook": "", "tiktok": ""}'
  );

  insert into public.categories (store_id, name, slug, sort_order) values
    (v_store_id, 'Sneakers', 'sneakers', 1) returning id into v_sneakers;
  insert into public.categories (store_id, name, slug, sort_order) values
    (v_store_id, 'Bags', 'bags', 2) returning id into v_bags;
  insert into public.categories (store_id, name, slug, sort_order) values
    (v_store_id, 'Watches', 'watches', 3) returning id into v_watches;

  insert into public.products (store_id, category_id, name, slug, description, price, stock_quantity, is_featured) values
    (v_store_id, v_sneakers, 'Classic White Sneakers', 'classic-white-sneakers', 'Clean everyday sneakers with a cushioned sole.', 350.00, 12, true),
    (v_store_id, v_sneakers, 'Runner Pro Black',       'runner-pro-black',       'Lightweight running shoe with breathable mesh.', 480.00, 6,  true),
    (v_store_id, v_bags,     'Leather Tote Bag',       'leather-tote-bag',       'Roomy tote in genuine leather.',                 420.00, 4,  true),
    (v_store_id, v_bags,     'Canvas Backpack',        'canvas-backpack',        'Durable backpack with laptop sleeve.',           260.00, 0,  false),
    (v_store_id, v_watches,  'Minimal Steel Watch',    'minimal-steel-watch',    'Stainless steel case, water resistant.',         550.00, 3,  false),
    (v_store_id, v_watches,  'Sport Digital Watch',    'sport-digital-watch',    'Stopwatch, alarm and backlight.',                180.00, 20, false);

  -- Bags are bulkier
  update public.products set delivery_size = 'medium' where store_id = v_store_id and category_id = v_bags;

  -- Delivery: zone pricing (settings rows were created automatically)
  update public.store_delivery_settings
  set method = 'zones', medium_surcharge = 5, large_surcharge = 20, free_delivery_min = 1500,
      pickup_address = 'Osu, Accra', pickup_lat = 5.5560, pickup_lng = -0.1820,
      delivery_note = 'Same-day delivery for orders before 2pm.'
  where store_id = v_store_id;

  insert into public.delivery_zones (store_id, name, description, fee, sort_order) values
    (v_store_id, 'Osu / Labone / Cantonments', 'Close to our shop',          15, 1),
    (v_store_id, 'Teshie / Nungua / La',       'Including Lashibi, Sakumono', 25, 2),
    (v_store_id, 'East Legon / Madina / Adenta', null,                         30, 3),
    (v_store_id, 'Tema / Community 1–25',      null,                          40, 4),
    (v_store_id, 'Kasoa / Weija',              null,                          45, 5);

  -- Payment: pay on delivery up to GH₵2,000. Online payment is switched on
  -- after connecting Paystack in the dashboard (Phase 9).
  update public.store_payment_settings
  set cod_enabled = true, cod_max_amount = 2000
  where store_id = v_store_id;

  raise notice 'Demo store created. Store ID: %', v_store_id;
end;
$$;
