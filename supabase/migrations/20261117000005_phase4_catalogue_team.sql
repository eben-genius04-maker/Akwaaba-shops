-- =============================================================================
-- Migration 5: Phase 4 — teammate emails and product photo saving
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- Run after migrations 1–4. Safe to run on a database that already has users.
--
-- 1. profiles.email: so store owners can see their teammates' email addresses
--    on the Staff page. Kept in sync with the login email automatically.
--    Visible only to the person, their teammates, and the platform admin.
-- 2. set_product_images(): saves a product's photo list (order + cover) in one
--    step, so a half-finished save can never leave photos out of order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Teammate emails
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'phone'), 30), ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

revoke execute on function public.handle_new_user(), public.handle_user_email_change()
  from public, anon, authenticated;

-- (Users still cannot edit profiles.email themselves: only full_name, phone and
--  avatar_url are granted for update in migration 3.)

-- -----------------------------------------------------------------------------
-- 2. Save a product's photos in one step
--
-- p_images: ordered list, first = cover photo, max 8:
--   [{ "storage_path": "{store_id}/products/abc.webp", "image_url": "https://…", "alt_text": "…" }]
-- Photos no longer in the list are removed. Returns their storage paths so the
-- app can delete the files.
--
-- SECURITY INVOKER: runs as the signed-in user, so the normal product_images
-- security rules apply on top of the checks below.
-- -----------------------------------------------------------------------------
create or replace function public.set_product_images(p_product_id uuid, p_images jsonb)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_prefix   text;
  v_removed  text[];
begin
  select store_id into v_store_id from public.products where id = p_product_id;
  if v_store_id is null or not public.is_store_member(v_store_id) then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if p_images is null or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Invalid photo list.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_images) > 8 then
    raise exception 'A product can have at most 8 photos.' using errcode = '22023';
  end if;

  v_prefix := v_store_id::text || '/products/';
  if exists (
    select 1 from jsonb_array_elements(p_images) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'storage_path', '') !~ ('^' || v_prefix || '[A-Za-z0-9._-]{1,100}$')
       or coalesce(e ->> 'image_url', '') !~ '^https?://'
       or char_length(coalesce(e ->> 'alt_text', '')) > 200
  ) then
    raise exception 'Invalid photo.' using errcode = '22023';
  end if;
  if (select count(distinct e ->> 'storage_path') from jsonb_array_elements(p_images) e) <> jsonb_array_length(p_images) then
    raise exception 'The same photo appears twice.' using errcode = '22023';
  end if;

  -- Remove photos that are no longer in the list
  with removed as (
    delete from public.product_images pi
    where pi.product_id = p_product_id
      and (pi.storage_path is null
           or pi.storage_path not in (select e ->> 'storage_path' from jsonb_array_elements(p_images) e))
    returning pi.storage_path
  )
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}') into v_removed from removed;

  -- Clear the cover first (only one cover allowed at a time)
  update public.product_images set is_primary = false
  where product_id = p_product_id and is_primary;

  -- Update order of photos already saved
  update public.product_images pi
  set sort_order = x.ord - 1,
      is_primary = (x.ord = 1),
      alt_text   = nullif(trim(x.e ->> 'alt_text'), '')
  from jsonb_array_elements(p_images) with ordinality as x(e, ord)
  where pi.product_id = p_product_id and pi.storage_path = x.e ->> 'storage_path';

  -- Add new photos
  insert into public.product_images (store_id, product_id, image_url, storage_path, alt_text, sort_order, is_primary)
  select v_store_id, p_product_id, x.e ->> 'image_url', x.e ->> 'storage_path',
         nullif(trim(x.e ->> 'alt_text'), ''), x.ord - 1, x.ord = 1
  from jsonb_array_elements(p_images) with ordinality as x(e, ord)
  where not exists (
    select 1 from public.product_images pi
    where pi.product_id = p_product_id and pi.storage_path = x.e ->> 'storage_path'
  );

  return v_removed;
end;
$$;

revoke execute on function public.set_product_images(uuid, jsonb) from public, anon;
grant execute on function public.set_product_images(uuid, jsonb) to authenticated;
