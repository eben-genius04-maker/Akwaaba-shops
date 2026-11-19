"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { paymentSettingsSchema } from "@/lib/validations/delivery";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";

export async function savePaymentSettings(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;

  const values = {
    codEnabled: formData.get("codEnabled") === "on" ? "on" : "off",
    codMaxAmount: String(formData.get("codMaxAmount") ?? ""),
    prepaidEnabled: formData.get("prepaidEnabled") === "on" ? "on" : "off",
  };
  const parsed = paymentSettingsSchema.safeParse({
    codEnabled: formData.get("codEnabled"),
    codMaxAmount: values.codMaxAmount,
    prepaidEnabled: formData.get("prepaidEnabled"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, message: "Please fix the highlighted fields." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("store_payment_settings")
    .select("paystack_subaccount_code")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!current) return { message: NO_PERMISSION };
  const connected = !!current.paystack_subaccount_code;

  if (d.prepaidEnabled && !connected) {
    return { message: "Connect Paystack before turning on MoMo and card payments.", values };
  }
  if (!d.codEnabled && !(d.prepaidEnabled && connected)) {
    return { message: "Keep at least one way for customers to pay.", values };
  }

  const { error } = await supabase
    .from("store_payment_settings")
    .update({ cod_enabled: d.codEnabled, cod_max_amount: d.codMaxAmount, prepaid_enabled: d.prepaidEnabled })
    .eq("store_id", storeId);

  // The database double-checks the same rules
  if (error?.code === "P0001") return { message: error.message, values };
  if (error) return { message: "We couldn't save your payment settings. Please try again.", values };

  revalidatePath(`/dashboard/${storeId}/payments`);
  revalidatePath(`/dashboard/${storeId}`);
  return { ok: true, message: "Payment settings saved." };
}
