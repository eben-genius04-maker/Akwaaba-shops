"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStoreBase, getStoreOrigin } from "@/lib/storefront";
import { startPayment, storeCanTakeOnlinePayment } from "@/lib/payments";
import { allow, allowIp, TOO_MANY } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { cartItemsSchema, checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { formatCedis, normalizeDigitalAddress } from "@/lib/format";
import type { CartIssue } from "@/actions/cart";

type Items = { productId: string; quantity: number }[];
const toDbItems = (items: Items) => items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));

type DeliveryErrorDetail = { distance_km?: number; max_distance_km?: number };

// Customer-friendly text for the database's delivery error codes
function deliveryMessage(code: string, detail?: DeliveryErrorDetail): string {
  switch (code) {
    case "zone_required": return "Choose your delivery area.";
    case "invalid_zone": return "That area is no longer available. Please choose another.";
    case "location_required": return "Pin your delivery location on the map.";
    case "out_of_range":
      return `Sorry, this store delivers up to ${Number(detail?.max_distance_km)} km away. Your location is about ${Number(detail?.distance_km)} km away.`;
    case "store_not_configured": return "This store hasn't finished setting up delivery yet. Please contact them on WhatsApp.";
    case "delivery_unavailable": return "This store isn't taking delivery orders right now.";
    default: return "We couldn't work out the delivery fee. Please try again.";
  }
}

export type Quote =
  | { ok: true; subtotal: number; deliveryFee: number; total: number; freeDelivery: boolean; distanceKm: number | null; surcharge: number }
  | { ok: false; issues?: CartIssue[]; deliveryError?: string; needs?: "zone" | "location"; message?: string };

// Live delivery fee + total while the customer fills in checkout
export async function getQuote(storeSlug: string, items: Items, zoneId: string | null, lat: number | null, lng: number | null): Promise<Quote> {
  const parsed = cartItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Your cart couldn't be read. Please go back to your cart." };
  if (!(await allowIp("quote", 120, 60))) return { ok: false, message: "Too many requests. Please wait a moment and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_delivery_quote", {
    p_store_slug: storeSlug,
    p_items: toDbItems(parsed.data),
    p_zone_id: zoneId && /^[0-9a-f-]{36}$/i.test(zoneId) ? zoneId : undefined,
    p_lat: lat ?? undefined,
    p_lng: lng ?? undefined,
  });
  if (error || !data) return { ok: false, message: error?.code === "P0002" ? "This store isn't available right now." : "We couldn't work out the delivery fee. Please try again." };

  const d = data as {
    ok: boolean; issues?: CartIssue[]; delivery_error?: string; detail?: DeliveryErrorDetail;
    subtotal?: number; delivery_fee?: number; total?: number;
    delivery?: { free_delivery: boolean; distance_km: number | null; surcharge: number };
  };
  if (!d.ok) {
    if (d.issues) return { ok: false, issues: d.issues };
    const code = d.delivery_error ?? "";
    return {
      ok: false,
      deliveryError: deliveryMessage(code, d.detail),
      needs: code === "zone_required" ? "zone" : code === "location_required" ? "location" : undefined,
    };
  }
  return {
    ok: true,
    subtotal: Number(d.subtotal),
    deliveryFee: Number(d.delivery_fee),
    total: Number(d.total),
    freeDelivery: !!d.delivery?.free_delivery,
    distanceKm: d.delivery?.distance_km == null ? null : Number(d.delivery.distance_km),
    surcharge: Number(d.delivery?.surcharge ?? 0),
  };
}

export type PlaceOrderResult =
  | { ok: true; token: string; orderNumber: number; payUrl?: string }
  | { ok: false; message?: string; fieldErrors?: Record<string, string[] | undefined>; issues?: CartIssue[] };

export async function placeOrder(storeSlug: string, input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    // The "address or directions" rule only runs once every field is valid, so check it
    // here too: the customer then sees every problem at once.
    const fieldErrors = fieldErrorsFrom(parsed.error) ?? {};
    const hasDigital = !!normalizeDigitalAddress(String(input.digitalAddress ?? ""));
    if (!hasDigital && String(input.landmark ?? "").trim().length < 5 && !fieldErrors.landmark && !fieldErrors.digitalAddress) {
      fieldErrors.landmark = ["Add your digital address, or directions for the rider (at least a few words)."];
    }
    return { ok: false, fieldErrors, message: "Please check the highlighted details." };
  }
  const d = parsed.data;
  // Checkout spam: per visitor (the database also limits waiting orders per phone)
  if (!(await allowIp("order", 15, 600))) return { ok: false, message: TOO_MANY };

  if (d.paymentMethod === "prepaid" && !(await storeCanTakeOnlinePayment(storeSlug))) {
    return { ok: false, message: "This store can't take MoMo or card payments right now. Please choose pay on delivery, or try again later." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_store_slug: storeSlug,
    p_items: toDbItems(d.items),
    p_customer: { name: d.name, phone: d.phone, email: d.email ?? "" },
    p_delivery: {
      zone_id: d.zoneId ?? "",
      lat: d.lat === null ? "" : String(d.lat),
      lng: d.lng === null ? "" : String(d.lng),
      digital_address: d.digitalAddress ?? "",
      landmark: d.landmark ?? "",
      area: d.area ?? "",
      city: d.city ?? "",
    },
    p_payment_method: d.paymentMethod,
    p_notes: d.notes ?? undefined,
  });

  // The database explains rule problems in plain words (P0001 / 22023)
  if (error) {
    if (error.code === "P0001" || error.code === "22023") return { ok: false, message: error.message };
    if (error.code === "P0002") return { ok: false, message: "This store isn't available right now." };
    return { ok: false, message: "We couldn't place your order. Please try again." };
  }

  const r = data as {
    ok: boolean; tracking_token?: string; order_number?: number; issues?: CartIssue[]; needs_payment?: boolean;
    delivery_error?: string; detail?: DeliveryErrorDetail; error?: string; cod_max_amount?: number;
  };
  if (!r.ok) {
    if (r.issues) return { ok: false, issues: r.issues, message: "Some items in your cart changed. Please review your cart." };
    if (r.delivery_error) return { ok: false, message: deliveryMessage(r.delivery_error, r.detail) };
    if (r.error === "cod_limit_exceeded") {
      return { ok: false, message: `Pay on delivery is only available for orders up to ${formatCedis(Number(r.cod_max_amount))}.` };
    }
    return { ok: false, message: "We couldn't place your order. Please try again." };
  }

  // Save the address to the customer's account if they asked (never blocks the order)
  if (d.saveAddress) {
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (userId) {
      await supabase.from("customer_addresses").insert({
        user_id: userId,
        label: d.addressLabel,
        recipient_name: d.name,
        phone: d.phone,
        digital_address: d.digitalAddress,
        landmark: d.landmark,
        area: d.area,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
      });
    }
  }

  // Online payment: create the Paystack payment straight away
  if (r.needs_payment) {
    const [origin, base] = await Promise.all([getStoreOrigin(), getStoreBase(storeSlug.toLowerCase())]);
    const started = await startPayment(r.tracking_token!, `${origin}${base}/order/${r.tracking_token}`);
    return { ok: true, token: r.tracking_token!, orderNumber: r.order_number!, payUrl: started.ok ? started.url : undefined };
  }
  return { ok: true, token: r.tracking_token!, orderNumber: r.order_number! };
}

// "Pay now" on the tracking page (first try failed, or the customer came back later)
export async function payForOrder(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const storeSlug = String(formData.get("storeSlug") ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) return { message: "Order not found." };
  if (!(await allow("pay", token, 10, 600))) return { message: TOO_MANY };
  const [origin, base] = await Promise.all([getStoreOrigin(), getStoreBase(storeSlug)]);
  const started = await startPayment(token, `${origin}${base}/order/${token}`);
  if (!started.ok) return { message: started.message };
  redirect(started.url);
}

// Customer cancels from the tracking page (only before the store confirms)
export async function cancelOrder(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const storeSlug = String(formData.get("storeSlug") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { message: "Order not found." };
  if (!(await allowIp("cancel", 20, 600))) return { message: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order_by_token", { p_token: token, p_reason: "Cancelled by customer" });
  if (error) return { message: error.code === "P0001" ? error.message : "We couldn't cancel this order. Please contact the store." };

  revalidatePath(`/s/${storeSlug}/order/${token}`);
  return { ok: true, message: "Your order has been cancelled." };
}
