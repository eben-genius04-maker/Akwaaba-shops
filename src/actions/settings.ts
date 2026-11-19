"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { storeSettingsSchema } from "@/lib/validations/settings";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { BUCKET, isStorePath, pathFromPublicUrl, publicUrl } from "@/lib/storage";

const KEYS = ["name", "description", "address", "whatsappNumber", "contactPhone", "email", "brandColor", "heroTitle", "heroSubtitle", "instagram", "facebook", "tiktok", "x"] as const;

export async function updateStoreSettings(_: FormState, formData: FormData): Promise<FormState> {
  const storeId = formData.get("storeId");
  const access = await getStoreAccess(storeId, ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const id = access.store.id;

  const values = Object.fromEntries(KEYS.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = storeSettingsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, message: "Please fix the highlighted fields." };
  const d = parsed.data;

  // Images were uploaded from the browser; only accept files in this store's branding folder.
  const logoPath = String(formData.get("logoPath") ?? "");
  const heroPath = String(formData.get("heroPath") ?? "");
  if ((logoPath && !isStorePath(logoPath, id, "branding")) || (heroPath && !isStorePath(heroPath, id, "branding"))) {
    return { message: "Invalid image. Please upload it again.", values };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("store_settings").select("logo_url, hero_image_url").eq("store_id", id).single();

  const { error: storeError } = await supabase.from("stores").update({ name: d.name }).eq("id", id);
  const { error } = await supabase
    .from("store_settings")
    .update({
      business_name: d.name,
      description: d.description,
      address: d.address,
      whatsapp_number: d.whatsappNumber,
      contact_phone: d.contactPhone,
      email: d.email,
      brand_color: d.brandColor,
      hero_title: d.heroTitle,
      hero_subtitle: d.heroSubtitle,
      logo_url: logoPath ? publicUrl(logoPath) : null,
      hero_image_url: heroPath ? publicUrl(heroPath) : null,
      social_links: { instagram: d.instagram, facebook: d.facebook, tiktok: d.tiktok, x: d.x },
    })
    .eq("store_id", id);

  if (error || storeError) return { message: "We couldn't save your settings. Please try again.", values };

  // Delete replaced/removed images
  const oldFiles = [pathFromPublicUrl(current?.logo_url), pathFromPublicUrl(current?.hero_image_url)].filter(
    (p): p is string => !!p && p !== logoPath && p !== heroPath,
  );
  if (oldFiles.length) await supabase.storage.from(BUCKET).remove(oldFiles);

  revalidatePath(`/dashboard/${id}`, "layout");
  revalidatePath(`/s/${access.store.slug}`);
  return { ok: true, message: "Settings saved." };
}
