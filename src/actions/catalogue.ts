"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { categorySchema, productImagesSchema, productSchema } from "@/lib/validations/catalogue";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { slugify } from "@/lib/format";
import { BUCKET, isStorePath, pathFromPublicUrl, publicUrl, thumbPath } from "@/lib/storage";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const UUID = /^[0-9a-f-]{36}$/i;

// Inserts/updates with a unique link name. If the name was generated
// automatically and is taken, tries "-2", "-3"…
async function withUniqueSlug<T>(
  slug: string,
  auto: boolean,
  run: (slug: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
): Promise<{ data: T | null; error: { code?: string } | null; slugTaken?: boolean }> {
  for (let i = 1; i <= 20; i++) {
    const candidate = i === 1 ? slug : `${slug.slice(0, 150)}-${i}`;
    const res = await run(candidate);
    if (res.error?.code !== "23505") return res;
    if (!auto) return { ...res, slugTaken: true };
  }
  return { data: null, error: { code: "23505" }, slugTaken: true };
}

// =============================================================================
// Categories (owner + manager)
// =============================================================================

export async function saveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner", "manager"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const categoryId = str(formData, "categoryId");
  if (categoryId && !UUID.test(categoryId)) return { message: "Category not found." };

  const values = {
    name: str(formData, "name"), slug: str(formData, "slug"), description: str(formData, "description"),
    isActive: formData.get("isActive") === "on" ? "on" : "off",
  };
  const parsed = categorySchema.safeParse({ ...values, isActive: formData.get("isActive") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const imagePath = str(formData, "imagePath");
  if (imagePath && !isStorePath(imagePath, storeId, "categories")) return { message: "Invalid image. Please upload it again.", values };

  const auto = !parsed.data.slug;
  const slug = parsed.data.slug || slugify(parsed.data.name, 100) || "category";
  const supabase = await createClient();
  const row = {
    name: parsed.data.name,
    description: parsed.data.description,
    is_active: parsed.data.isActive,
    image_url: imagePath ? publicUrl(imagePath) : null,
  };

  let oldImage: string | null = null;
  if (categoryId) {
    const { data: existing } = await supabase.from("categories").select("image_url").eq("id", categoryId).eq("store_id", storeId).maybeSingle();
    if (!existing) return { message: "Category not found." };
    oldImage = pathFromPublicUrl(existing.image_url);
  }

  const res = await withUniqueSlug(slug, auto, async (s) => {
    if (categoryId) {
      return supabase.from("categories").update({ ...row, slug: s }).eq("id", categoryId).eq("store_id", storeId).select("id").single();
    }
    const { data: last } = await supabase.from("categories").select("sort_order").eq("store_id", storeId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    return supabase.from("categories").insert({ ...row, slug: s, store_id: storeId, sort_order: (last?.sort_order ?? 0) + 1 }).select("id").single();
  });

  if (res.slugTaken) return { fieldErrors: { slug: ["Another category already uses this link name."] }, values };
  if (res.error) return { message: "We couldn't save the category. Please try again.", values };

  if (oldImage && oldImage !== imagePath) await supabase.storage.from(BUCKET).remove([oldImage]);

  revalidatePath(`/dashboard/${storeId}/categories`);
  redirect(`/dashboard/${storeId}/categories?saved=${encodeURIComponent(parsed.data.name)}`);
}

export async function deleteCategory(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner", "manager"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const categoryId = str(formData, "categoryId");

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", categoryId).eq("store_id", storeId).select("name, image_url").maybeSingle();
  if (error || !data) return { message: "We couldn't delete this category." };

  const img = pathFromPublicUrl(data.image_url);
  if (img) await supabase.storage.from(BUCKET).remove([img]);

  revalidatePath(`/dashboard/${storeId}/categories`);
  redirect(`/dashboard/${storeId}/categories?deleted=${encodeURIComponent(data.name)}`);
}

export async function moveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner", "manager"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const categoryId = str(formData, "categoryId");
  const direction = str(formData, "direction") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: list } = await supabase.from("categories").select("id").eq("store_id", storeId).order("sort_order").order("name");
  if (!list) return { message: "Couldn't reorder." };
  const ids = list.map((c) => c.id);
  const i = ids.indexOf(categoryId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];

  // Renumber everything so the order is always clean: 1, 2, 3…
  const results = await Promise.all(ids.map((id, n) => supabase.from("categories").update({ sort_order: n + 1 }).eq("id", id).eq("store_id", storeId)));
  if (results.some((r) => r.error)) return { message: "Couldn't reorder." };

  revalidatePath(`/dashboard/${storeId}/categories`);
  return {};
}

// =============================================================================
// Products (all members save; owner + manager delete)
// =============================================================================

export async function saveProduct(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"));
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const productId = str(formData, "productId");
  if (productId && !UUID.test(productId)) return { message: "Product not found." };

  const values = {
    name: str(formData, "name"), slug: str(formData, "slug"), description: str(formData, "description"),
    price: str(formData, "price"), categoryId: str(formData, "categoryId"), stockQuantity: str(formData, "stockQuantity"),
    deliverySize: str(formData, "deliverySize"),
    // Echo switches back so they keep their position if there's an error
    isActive: formData.get("isActive") === "on" ? "on" : "off",
    isAvailable: formData.get("isAvailable") === "on" ? "on" : "off",
    isFeatured: formData.get("isFeatured") === "on" ? "on" : "off",
  };
  const parsed = productSchema.safeParse({
    ...values,
    isActive: formData.get("isActive"), isAvailable: formData.get("isAvailable"), isFeatured: formData.get("isFeatured"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, message: "Please fix the highlighted fields." };

  let images;
  try {
    images = productImagesSchema.parse(JSON.parse(str(formData, "images") || "[]"));
  } catch {
    return { message: "Something went wrong with the photos. Please re-add them.", values };
  }
  if (images.some((img) => !isStorePath(img.path, storeId, "products"))) {
    return { message: "Invalid photo. Please re-add it.", values };
  }

  const d = parsed.data;
  const auto = !d.slug;
  const slug = d.slug || slugify(d.name, 150) || "product";
  const row = {
    name: d.name, description: d.description, price: d.price, category_id: d.categoryId,
    stock_quantity: d.stockQuantity, delivery_size: d.deliverySize,
    is_active: d.isActive, is_available: d.isAvailable, is_featured: d.isFeatured,
  };

  const supabase = await createClient();
  const res = await withUniqueSlug(slug, auto, (s) =>
    productId
      ? supabase.from("products").update({ ...row, slug: s }).eq("id", productId).eq("store_id", storeId).select("id").single()
      : supabase.from("products").insert({ ...row, slug: s, store_id: storeId }).select("id").single(),
  );

  if (res.slugTaken) return { fieldErrors: { slug: ["Another product already uses this link name."] }, values };
  if (res.error || !res.data) {
    if (res.error?.code === "23503") return { fieldErrors: { categoryId: ["That category no longer exists."] }, values };
    return { message: productId ? "We couldn't save this product." : "We couldn't create this product.", values };
  }
  const id = (res.data as { id: string }).id;

  const { data: removed, error: imgError } = await supabase.rpc("set_product_images", {
    p_product_id: id,
    p_images: images.map((img) => ({ storage_path: img.path, image_url: publicUrl(img.path), alt_text: img.alt ?? "" })),
  });
  if (imgError) {
    revalidatePath(`/dashboard/${storeId}/products`);
    redirect(`/dashboard/${storeId}/products/${id}?photos=failed`);
  }
  if (removed?.length) await supabase.storage.from(BUCKET).remove(removed.flatMap((p) => [p, thumbPath(p)]));

  revalidatePath(`/dashboard/${storeId}/products`);
  revalidatePath(`/dashboard/${storeId}`);
  redirect(`/dashboard/${storeId}/products?saved=${encodeURIComponent(d.name)}`);
}

export async function deleteProduct(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner", "manager"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const productId = str(formData, "productId");

  const supabase = await createClient();
  const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", productId);
  const { data, error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId).select("name").maybeSingle();
  if (error || !data) return { message: "We couldn't delete this product." };

  const paths = (imgs ?? []).map((i) => i.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]));

  revalidatePath(`/dashboard/${storeId}/products`);
  revalidatePath(`/dashboard/${storeId}`);
  redirect(`/dashboard/${storeId}/products?deleted=${encodeURIComponent(data.name)}`);
}

// Quick show/hide from the product list
export async function toggleProductActive(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"));
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const productId = str(formData, "productId");
  const makeActive = str(formData, "active") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").update({ is_active: makeActive }).eq("id", productId).eq("store_id", storeId).select("name").maybeSingle();
  if (error || !data) return { message: "Couldn't update the product." };

  revalidatePath(`/dashboard/${storeId}/products`);
  return { ok: true, message: makeActive ? `"${data.name}" is now visible in your store.` : `"${data.name}" is now hidden from customers.` };
}
