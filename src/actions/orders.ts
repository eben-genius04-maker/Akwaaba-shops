"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";
import type { OrderStatus } from "@/lib/orders";
import { expireUnpaidOrders } from "@/lib/payments";
import { serverEnv } from "@/lib/server-env";

const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

const DONE: Partial<Record<OrderStatus, string>> = {
  confirmed: "Order confirmed. The customer can see it on their tracking page.",
  processing: "Marked as preparing.",
  out_for_delivery: "Marked as out for delivery.",
  delivered: "Marked as delivered.",
  cancelled: "Order cancelled. Stock has been put back.",
};

function refresh(storeId: string, orderId: string) {
  revalidatePath(`/dashboard/${storeId}/orders/${orderId}`);
  revalidatePath(`/dashboard/${storeId}/orders`);
  revalidatePath(`/dashboard/${storeId}`);
}

// The database checks the allowed steps and who may do them (e.g. only owners/managers cancel)
export async function changeOrderStatus(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"));
  if (!access) return { message: NO_PERMISSION };
  const orderId = str(formData, "orderId");
  const status = str(formData, "status") as OrderStatus;
  if (!UUID.test(orderId) || !STATUSES.includes(status)) return { message: "Order not found." };
  const note = str(formData, "note").trim().slice(0, 500);
  if (status === "cancelled" && note.length < 3) return { fieldErrors: { note: ["Tell the customer why (a few words)."] }, message: "Add a reason for cancelling." };

  const supabase = await createClient();
  // Only orders of this store
  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).eq("store_id", access.store.id).maybeSingle();
  if (!order) return { message: "Order not found." };

  const { error } = await supabase.rpc("update_order_status", { p_order_id: orderId, p_status: status, p_note: note || undefined });
  if (error) {
    if (["P0001", "42501"].includes(error.code ?? "")) return { message: error.message };
    return { message: "We couldn't update this order. Please try again." };
  }
  refresh(access.store.id, orderId);
  return { ok: true, message: DONE[status] ?? "Order updated." };
}

export async function adjustDeliveryFee(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner", "manager"]);
  if (!access) return { message: NO_PERMISSION };
  const orderId = str(formData, "orderId");
  const raw = str(formData, "fee").replace(/[,\s]|GH₵|GHS/gi, "");
  const values = { fee: str(formData, "fee"), note: str(formData, "note") };
  if (!UUID.test(orderId)) return { message: "Order not found." };
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(raw) || Number(raw) > 10000) return { fieldErrors: { fee: ["Enter an amount like 25 or 30.50."] }, values };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).eq("store_id", access.store.id).maybeSingle();
  if (!order) return { message: "Order not found." };
  const { error } = await supabase.rpc("adjust_delivery_fee", { p_order_id: orderId, p_fee: Number(raw), p_note: values.note.trim() || undefined });
  if (error) return { message: ["P0001", "22023"].includes(error.code ?? "") ? error.message : "We couldn't change the fee.", values };
  refresh(access.store.id, orderId);
  return { ok: true, message: "Delivery fee updated. The customer sees the new total." };
}

export async function saveStaffNotes(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"));
  if (!access) return { message: NO_PERMISSION };
  const orderId = str(formData, "orderId");
  const notes = str(formData, "staffNotes").trim();
  if (!UUID.test(orderId)) return { message: "Order not found." };
  if (notes.length > 2000) return { fieldErrors: { staffNotes: ["Too long (max 2,000 characters)."] }, values: { staffNotes: notes } };

  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").update({ staff_notes: notes || null }).eq("id", orderId).eq("store_id", access.store.id).select("id");
  if (error || !data?.length) return { message: "We couldn't save the note." };
  revalidatePath(`/dashboard/${access.store.id}/orders/${orderId}`);
  return { ok: true, message: "Note saved." };
}

export type OrderPulse = { pending: number; latest: { id: string; number: number; total: number; name: string; createdAt: string } | null };

// Polled by the dashboard every few seconds to announce new orders
export async function getOrderPulse(storeId: string): Promise<OrderPulse | null> {
  const access = await getStoreAccess(storeId);
  if (!access) return null;
  if (serverEnv.paymentsConfigured()) await expireUnpaidOrders();
  const supabase = await createClient();
  const [{ count }, { data: latest }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", access.store.id).eq("status", "pending"),
    supabase.from("orders").select("id, order_number, total, customer_name, created_at").eq("store_id", access.store.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    pending: count ?? 0,
    latest: latest ? { id: latest.id, number: latest.order_number, total: Number(latest.total), name: latest.customer_name, createdAt: latest.created_at } : null,
  };
}
