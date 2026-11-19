import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreBase, getStoreOrigin, getStorefront } from "@/lib/storefront";
import { formatGhanaPhone } from "@/lib/format";
import { env } from "@/lib/env";
import { CheckoutForm, type CheckoutConfig, type SavedAddress } from "@/components/storefront/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/s/[store]/checkout">) {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  if (!store) notFound();
  const [base, origin] = await Promise.all([getStoreBase(store.slug), getStoreOrigin()]);

  if (store.status !== "active") {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout opens after approval</h1>
        <p className="mt-2 text-muted">This is a preview. Customers can place orders once Akwaaba Shops approves your store.</p>
        <Link href={`${base}/cart`} className="mt-6 inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 font-medium">Back to cart</Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: cfgData }, { data: claims }] = await Promise.all([
    supabase.rpc("get_checkout_config", { p_store_slug: store.slug }),
    supabase.auth.getClaims(),
  ]);
  const raw = cfgData as null | {
    delivery: { enabled: boolean; method: "zones" | "distance"; free_delivery_min: number | null; max_distance_km: number | null; note: string | null; zones: { id: string; name: string; description: string | null; fee: number }[] | null };
    payment: { pay_on_delivery: boolean; cod_max_amount: number | null; prepaid: boolean };
  };
  if (!raw) notFound();
  const config: CheckoutConfig = {
    deliveryEnabled: raw.delivery.enabled,
    method: raw.delivery.method,
    freeDeliveryMin: raw.delivery.free_delivery_min === null ? null : Number(raw.delivery.free_delivery_min),
    maxDistanceKm: raw.delivery.max_distance_km === null ? null : Number(raw.delivery.max_distance_km),
    note: raw.delivery.note,
    zones: (raw.delivery.zones ?? []).map((z) => ({ ...z, fee: Number(z.fee) })),
    payOnDelivery: raw.payment.pay_on_delivery,
    codMaxAmount: raw.payment.cod_max_amount === null ? null : Number(raw.payment.cod_max_amount),
    prepaid: raw.payment.prepaid,
  };

  // Signed-in customer: pre-fill details and offer saved addresses
  const userId = claims?.claims?.sub;
  let customer: { name: string; phone: string; email: string } | null = null;
  let addresses: SavedAddress[] = [];
  if (userId) {
    const [{ data: profile }, { data: saved }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, email").eq("id", userId).maybeSingle(),
      supabase.from("customer_addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    customer = {
      name: profile?.full_name ?? "",
      phone: profile?.phone && /^233\d{9}$/.test(profile.phone) ? formatGhanaPhone(profile.phone) : profile?.phone ?? "",
      email: profile?.email ?? (typeof claims?.claims?.email === "string" ? claims.claims.email : ""),
    };
    addresses = (saved ?? []).map((a) => ({
      id: a.id, label: a.label, name: a.recipient_name, phone: formatGhanaPhone(a.phone), digitalAddress: a.digital_address ?? "",
      landmark: a.landmark ?? "", area: a.area ?? "", city: a.city ?? "", lat: a.lat, lng: a.lng, isDefault: a.is_default,
    }));
  }

  const here = `${origin}${base}/checkout`;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
      <CheckoutForm
        config={config}
        customer={customer}
        addresses={addresses}
        loginHref={`${env.siteUrl}/login?next=${encodeURIComponent(here)}`}
      />
    </div>
  );
}
