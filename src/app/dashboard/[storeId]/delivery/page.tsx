import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { amountInput } from "@/lib/delivery";
import { DeliveryEditor } from "./delivery-editor";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: PageProps<"/dashboard/[storeId]/delivery">) {
  const { storeId } = await params;
  const { store } = await requireStoreAccess(storeId);
  if (store.role === "staff") notFound();

  const supabase = await createClient();
  const [{ data: s }, { data: zones }] = await Promise.all([
    supabase.from("store_delivery_settings").select("*").eq("store_id", storeId).single(),
    supabase.from("delivery_zones").select("id, name, description, fee, is_active").eq("store_id", storeId).order("sort_order").order("name"),
  ]);
  if (!s) notFound();

  return (
    <>
      <PageHeader title="Delivery" description="How much customers pay for delivery. Your riders deliver; we calculate the fee at checkout." />
      <DeliveryEditor
        // Remount after each save so the form shows exactly what was saved
        key={s.updated_at}
        storeId={storeId}
        initial={{
          deliveryEnabled: s.delivery_enabled ? "on" : "off",
          method: s.method,
          pickupAddress: s.pickup_address ?? "",
          pickupLat: s.pickup_lat === null ? "" : String(s.pickup_lat),
          pickupLng: s.pickup_lng === null ? "" : String(s.pickup_lng),
          baseFee: amountInput(s.base_fee),
          perKmFee: amountInput(s.per_km_fee),
          maxDistanceKm: s.max_distance_km === null ? "" : String(Number(s.max_distance_km)),
          roadFactor: Number(s.road_factor).toFixed(2),
          mediumSurcharge: amountInput(s.medium_surcharge),
          largeSurcharge: amountInput(s.large_surcharge),
          freeDeliveryMin: amountInput(s.free_delivery_min),
          deliveryNote: s.delivery_note ?? "",
        }}
        zones={(zones ?? []).map((z) => ({ id: z.id, name: z.name, description: z.description ?? "", fee: Number(z.fee), isActive: z.is_active }))}
      />
    </>
  );
}
