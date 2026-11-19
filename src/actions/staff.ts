"use server";

import { allow } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/forms";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["manager", "staff"], { message: "Choose a role." }),
});
const roleSchema = z.enum(["owner", "manager", "staff"]);

export type InviteState = FormState & { inviteUrl?: string; inviteEmail?: string };

export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;

  const values = { email: str(formData, "email"), role: str(formData, "role") };
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues.map((i) => i.message) }, values };
  if (!(await allow("invite", storeId, 30, 86400))) return { message: "You've sent a lot of invitations today. Please try again tomorrow.", values };

  const supabase = await createClient();

  // Already in the team?
  const { data: members } = await supabase.from("store_members").select("profile:profiles(email)").eq("store_id", storeId);
  if (members?.some((m) => m.profile?.email?.toLowerCase() === parsed.data.email)) {
    return { fieldErrors: { email: ["This person is already in your team."] }, values };
  }

  const { data, error } = await supabase
    .from("store_invitations")
    .insert({ store_id: storeId, email: parsed.data.email, role: parsed.data.role, invited_by: access.user.id })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") return { fieldErrors: { email: ["There's already an open invitation for this email. Copy its link below."] }, values };
    return { message: "We couldn't create the invitation. Please try again.", values };
  }

  revalidatePath(`/dashboard/${storeId}/staff`);
  return { ok: true, inviteUrl: `${env.siteUrl}/invite/${data.token}`, inviteEmail: parsed.data.email };
}

export async function revokeInvitation(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", str(formData, "invitationId"))
    .eq("store_id", access.store.id)
    .select("email")
    .maybeSingle();
  if (error || !data) return { message: "Couldn't cancel the invitation." };
  revalidatePath(`/dashboard/${access.store.id}/staff`);
  return { ok: true, message: `Invitation for ${data.email} cancelled.` };
}

export async function changeMemberRole(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const userId = str(formData, "userId");
  const role = roleSchema.safeParse(str(formData, "role"));
  if (!role.success) return { message: "Choose a role." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_members")
    .update({ role: role.data })
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error) {
    if (error.code === "P0001") return { message: "Your store needs at least one owner. Make someone else an owner first." };
    return { message: "Couldn't change the role." };
  }
  if (!data) return { message: "Team member not found." };

  revalidatePath(`/dashboard/${storeId}`, "layout");
  if (userId === access.user.id && role.data !== "owner") redirect(`/dashboard/${storeId}`);
  return { ok: true, message: "Role updated." };
}

export async function removeMember(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const storeId = access.store.id;
  const userId = str(formData, "userId");

  const supabase = await createClient();
  const { data, error } = await supabase.from("store_members").delete().eq("store_id", storeId).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) {
    if (error.code === "P0001") return { message: "Your store needs at least one owner. Make someone else an owner first." };
    return { message: "Couldn't remove this person." };
  }
  if (!data) return { message: "Team member not found." };

  if (userId === access.user.id) redirect("/dashboard");
  revalidatePath(`/dashboard/${storeId}/staff`);
  return { ok: true, message: "Removed from your team." };
}

export async function acceptInvitation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const token = str(formData, "token");
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const supabase = await createClient();
  const { data: storeId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { message: error.message || "We couldn't accept this invitation." };
  redirect(`/dashboard/${storeId}?joined=1`);
}
