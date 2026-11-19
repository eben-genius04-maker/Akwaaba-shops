"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";

const UUID = /^[0-9a-f-]{36}$/i;
const DENIED = "Only platform administrators can do this.";

function refresh(storeId: string) {
  revalidatePath("/platform", "layout");
  revalidatePath(`/platform/stores/${storeId}`);
  revalidatePath(`/dashboard/${storeId}`, "layout");
}

// The database checks again that the caller is a platform admin, and logs every change.
export async function changeStoreStatus(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) return { message: DENIED };
  const storeId = String(formData.get("storeId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!UUID.test(storeId) || !["active", "suspended"].includes(status)) return { message: "Store not found." };
  if (status === "suspended" && reason.length < 5) {
    return { fieldErrors: { reason: ["Write a short reason. The store owner will see it."] }, message: "Add a reason for suspending." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_store_status", {
    p_store_id: storeId,
    p_status: status as "active" | "suspended",
    p_reason: status === "suspended" ? reason : undefined,
  });
  if (error) return { message: error.code === "42501" ? DENIED : "We couldn't update this store." };
  refresh(storeId);
  return { ok: true, message: status === "active" ? "Store is live. Customers can now see it and order." : "Store suspended. It's hidden from customers." };
}

export async function changeCommission(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) return { message: DENIED };
  const storeId = String(formData.get("storeId") ?? "");
  const raw = String(formData.get("percent") ?? "").trim().replace("%", "");
  if (!UUID.test(storeId)) return { message: "Store not found." };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(raw) || Number(raw) > 20) {
    return { fieldErrors: { percent: ["Enter a percentage from 0 to 20, e.g. 1 or 0.5."] }, values: { percent: raw } };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_store_platform_fee", { p_store_id: storeId, p_percent: Number(raw) });
  if (error) return { message: error.code === "42501" ? DENIED : error.message, values: { percent: raw } };
  refresh(storeId);
  return { ok: true, message: `Commission set to ${Number(raw)}%. It applies to new online payments.` };
}
