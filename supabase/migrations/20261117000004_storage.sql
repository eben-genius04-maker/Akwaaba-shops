-- =============================================================================
-- Migration 4 of 4: Storage bucket and upload rules
-- Multi-store commerce platform · LoneWolf Digital Technologies
--
-- One public bucket, "store-assets". Files live under the store's ID:
--   {store_id}/products/{file}     any store member
--   {store_id}/categories/{file}   owner or manager
--   {store_id}/branding/{file}     owner only (logo, hero image)
-- Anyone can VIEW by URL; uploading/replacing/deleting is controlled below.
-- =============================================================================


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Decides whether the current user may write a given object path
create or replace function public.can_manage_store_asset(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts    text[] := string_to_array(p_object_name, '/');
  v_store_id uuid;
  v_folder   text;
begin
  -- Expect exactly {store_id}/{folder}/{filename}
  if array_length(v_parts, 1) <> 3 or v_parts[3] = '' then
    return false;
  end if;

  v_store_id := public.try_uuid(v_parts[1]);
  v_folder   := v_parts[2];

  if v_store_id is null then
    return false;
  end if;

  return case v_folder
    when 'products'   then public.is_store_member(v_store_id)
    when 'categories' then public.has_store_role(v_store_id, array['owner', 'manager']::public.member_role[])
    when 'branding'   then public.has_store_role(v_store_id, array['owner']::public.member_role[])
    else false
  end;
end;
$$;

revoke execute on function public.can_manage_store_asset(text) from public, anon;
grant  execute on function public.can_manage_store_asset(text) to authenticated;

create policy "store-assets: members upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets' and public.can_manage_store_asset(name));

create policy "store-assets: members update"
  on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and public.can_manage_store_asset(name))
  with check (bucket_id = 'store-assets' and public.can_manage_store_asset(name));

create policy "store-assets: members delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and public.can_manage_store_asset(name));

-- Lets the dashboard list a store's files (public URLs work without this)
create policy "store-assets: members list"
  on storage.objects for select to authenticated
  using (bucket_id = 'store-assets' and public.can_manage_store_asset(name));
