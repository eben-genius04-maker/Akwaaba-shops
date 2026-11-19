"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { deliverySettingsSchema, deliveryZoneSchema } from "@/lib/validations/delivery";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const UUID = /^[0-9a-f-]{36}$/i;
const onOff = (fd: FormData, k: string) => (fd.get(k) === "on" ? "on" : "off");
const MANAGERS = ["owner", "manager"] as const;

function refresh(storeId: string, slug: string) {
  revalidatePath(`/dashboard/${storeId}/delivery`);
  revalidatePath(`/dashboard/${storeId}`);
  revalidatePath(`/s/${slug}`);
}

// =============================================================================
// Delivery settings (owner + manager)
// =============================================================================

const SETTING_KEYS = [
  "method", "pickupAddress", "pickupLat", "pickupLng", "baseFee", "perKmFee", "maxDistanceKm",
  "roadFactor", "mediumSurcharge", "largeSurcharge", "freeDeliveryMin", "deliveryNote",
] as const;

export async function saveDeliverySettings(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), [...MANAGERS]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;

  const values: Record<string, string> = Object.fromEntries(SETTING_KEYS.map((k) => [k, str(formData, k)]));
  values.deliveryEnabled = onOff(formData, "deliveryEnabled");
  const parsed = deliverySettingsSchema.safeParse({ ...values, deliveryEnabled: formData.get("deliveryEnabled") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, message: "Please fix the highlighted fields." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_delivery_settings")
    .update({
      delivery_enabled: d.deliveryEnabled,
      method: d.method,
      pickup_address: d.pickupAddress,
      pickup_lat: d.pickupLat,
      pickup_lng: d.pickupLng,
      base_fee: d.baseFee,
      per_km_fee: d.perKmFee,
      max_distance_km: d.maxDistanceKm,
      road_factor: d.roadFactor,
      medium_surcharge: d.mediumSurcharge,
      large_surcharge: d.largeSurcharge,
      free_delivery_min: d.freeDeliveryMin,
      delivery_note: d.deliveryNote,
    })
    .eq("store_id", storeId)
    .select("store_id");

  if (error || !data?.length) return { message: "We couldn't save your delivery settings. Please try again.", values };

  refresh(storeId, access.store.slug);
  return { ok: true, message: "Delivery settings saved." };
}

// =============================================================================
// Delivery zones (owner + manager)
// =============================================================================

export async function saveZone(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), [...MANAGERS]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const zoneId = str(formData, "zoneId");
  if (zoneId && !UUID.test(zoneId)) return { message: "Area not found." };

  const values = { name: str(formData, "name"), description: str(formData, "description"), fee: str(formData, "fee"), isActive: onOff(formData, "isActive") };
  const parsed = deliveryZoneSchema.safeParse({ ...values, isActive: formData.get("isActive") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  const z = parsed.data;
  const row = { name: z.name, description: z.description, fee: z.fee, is_active: z.isActive };

  const supabase = await createClient();
  let error: { code?: string; message?: string } | null;
  if (zoneId) {
    const res = await supabase.from("delivery_zones").update(row).eq("id", zoneId).eq("store_id", storeId).select("id");
    error = res.error;
    if (!error && !res.data?.length) return { message: "Area not found." };
  } else {
    const { data: last } = await supabase.from("delivery_zones").select("sort_order").eq("store_id", storeId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await supabase.from("delivery_zones").insert({ ...row, store_id: storeId, sort_order: (last?.sort_order ?? 0) + 1 }));
  }

  if (error?.code === "23505") return { fieldErrors: { name: ["You already have an area with this name."] }, values };
  if (error?.message?.includes("at most 50")) return { message: "You can have at most 50 delivery areas.", values };
  if (error) return { message: "We couldn't save this area. Please try again.", values };

  refresh(storeId, access.store.slug);
  return { ok: true, message: zoneId ? `"${z.name}" updated.` : `"${z.name}" added.` };
}

export async function toggleZone(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), [...MANAGERS]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const zoneId = str(formData, "zoneId");
  const active = str(formData, "active") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase.from("delivery_zones").update({ is_active: active }).eq("id", zoneId).eq("store_id", storeId).select("name");
  if (error || !data?.length) return { message: "We couldn't update this area." };

  refresh(storeId, access.store.slug);
  return { ok: true, message: active ? `"${data[0].name}" is available at checkout.` : `"${data[0].name}" is hidden from checkout.` };
}

export async function deleteZone(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), [...MANAGERS]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const zoneId = str(formData, "zoneId");
  if (!UUID.test(zoneId)) return { message: "Area not found." };

  // Past orders keep their own copy of the area name and fee, so deleting is safe.
  const supabase = await createClient();
  const { data, error } = await supabase.from("delivery_zones").delete().eq("id", zoneId).eq("store_id", storeId).select("name");
  if (error || !data?.length) return { message: "We couldn't delete this area." };

  refresh(storeId, access.store.slug);
  return { ok: true, message: `"${data[0].name}" deleted.` };
}

export async function moveZone(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), [...MANAGERS]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const zoneId = str(formData, "zoneId");
  const direction = str(formData, "direction") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: list } = await supabase.from("delivery_zones").select("id").eq("store_id", storeId).order("sort_order").order("name");
  if (!list) return { message: "Couldn't reorder." };
  const ids = list.map((z) => z.id);
  const i = ids.indexOf(zoneId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];

  const results = await Promise.all(ids.map((id, n) => supabase.from("delivery_zones").update({ sort_order: n + 1 }).eq("id", id).eq("store_id", storeId)));
  if (results.some((r) => r.error)) return { message: "Couldn't reorder." };

  refresh(storeId, access.store.slug);
  return {};
}
