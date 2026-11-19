"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/forms";

const UUID = /^[0-9a-f-]{36}$/i;

// Row-level security makes sure people can only change their own addresses.
export async function deleteAddress(_: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("addressId") ?? "");
  if (!UUID.test(id)) return { message: "Address not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_addresses").delete().eq("id", id).select("label");
  if (error || !data?.length) return { message: "We couldn't delete this address." };
  revalidatePath("/account");
  return { ok: true, message: `"${data[0].label}" deleted.` };
}

export async function makeDefaultAddress(_: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("addressId") ?? "");
  if (!UUID.test(id)) return { message: "Address not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id).select("label");
  if (error || !data?.length) return { message: "We couldn't update this address." };
  revalidatePath("/account");
  return { ok: true, message: `"${data[0].label}" is now your default address.` };
}
