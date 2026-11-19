"use server";

import { allow } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";
import { createStoreSchema } from "@/lib/validations/store";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";

export async function createStore(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/new");

  const values = { name: String(formData.get("name") ?? ""), slug: String(formData.get("slug") ?? "") };
  const parsed = createStoreSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!(await allow("create-store", user.id, 5, 86400))) return { message: "You've created several stores today. Please try again tomorrow.", values };

  const supabase = await createClient();
  const { data: storeId, error } = await supabase.rpc("create_store", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { slug: ["That store address is already taken. Try another."] }, values };
    }
    if (error.code === "23514") {
      return { fieldErrors: { slug: ["That address isn't allowed. Please choose another."] }, values };
    }
    if (error.code === "P0001") return { message: error.message, values }; // e.g. store limit reached
    return { message: "We couldn't create your store. Please try again.", values };
  }

  redirect(`/dashboard/${storeId}?welcome=1`);
}
