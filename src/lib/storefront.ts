import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getStoreSlugFromHost } from "@/lib/tenant";

// Data for the public storefront. Row-level security decides what's visible:
// the public sees ACTIVE stores only; a store's team can also preview a pending store.
// Hidden products/categories are filtered explicitly here, because the team can read them.

const STORE_COLUMNS =
  "id, name, slug, status, store_settings(business_name, description, logo_url, whatsapp_number, contact_phone, email, address, brand_color, hero_title, hero_subtitle, hero_image_url, social_links, currency)";

export const getStorefront = cache(async (slug: string) => {
  const supabase = await createClient();
  let { data, error } = await supabase.from("stores").select(STORE_COLUMNS).eq("slug", slug.toLowerCase()).maybeSingle();
  // A broken login session shouldn't hide a live shop: try again signed out
  if (error) {
    console.error("getStorefront:", error.message);
    ({ data, error } = await createPublicClient().from("stores").select(STORE_COLUMNS).eq("slug", slug.toLowerCase()).maybeSingle());
  }
  if (!data) return null;
  const s = data.store_settings;
  return {
    id: data.id,
    slug: data.slug,
    status: data.status,
    name: s?.business_name ?? data.name,
    description: s?.description ?? null,
    logoUrl: s?.logo_url ?? null,
    whatsapp: s?.whatsapp_number ?? null,
    phone: s?.contact_phone ?? null,
    email: s?.email ?? null,
    address: s?.address ?? null,
    brandColor: s?.brand_color ?? "#0b6e4f",
    heroTitle: s?.hero_title ?? null,
    heroSubtitle: s?.hero_subtitle ?? null,
    heroImageUrl: s?.hero_image_url ?? null,
    socials: (s?.social_links ?? {}) as Record<string, string | null>,
  };
});

export type Storefront = NonNullable<Awaited<ReturnType<typeof getStorefront>>>;

// Links inside a storefront: "" on the store's own subdomain (kofishoes.akwaabashops.com/p/…),
// "/s/kofishoes" on the main domain (akwaabashops.com/s/kofishoes/p/…).
export async function getStoreBase(slug: string): Promise<string> {
  const host = (await headers()).get("host");
  return getStoreSlugFromHost(host) === slug ? "" : `/s/${slug}`;
}

// Full public address of the current page's store, for sharing (WhatsApp, social previews)
export async function getStoreOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Delivery info customers may see (free-delivery threshold, note). Live stores only.
export const getPublicDeliveryInfo = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_checkout_config", { p_store_slug: slug });
  const cfg = data as null | {
    delivery: { enabled: boolean; free_delivery_min: number | null; note: string | null };
    payment: { pay_on_delivery: boolean; prepaid: boolean };
  };
  if (!cfg) return null;
  return {
    enabled: cfg.delivery.enabled,
    freeDeliveryMin: cfg.delivery.free_delivery_min === null ? null : Number(cfg.delivery.free_delivery_min),
    note: cfg.delivery.note,
    payOnDelivery: cfg.payment.pay_on_delivery,
    prepaid: cfg.payment.prepaid,
  };
});

// Escapes % and _ so a search for "50%" doesn't act as a wildcard
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Picks the cover photo from a product's images
export function coverImage(images: { image_url: string; sort_order: number; is_primary: boolean }[] | null | undefined) {
  if (!images?.length) return null;
  return [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0].image_url;
}
