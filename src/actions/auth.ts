"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { emailOnlySchema, loginSchema, newPasswordSchema, signupSchema } from "@/lib/validations/auth";
import { fieldErrorsFrom, safeNextPath, type FormState } from "@/lib/forms";
import { allow, allowIp, TOO_MANY } from "@/lib/rate-limit";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const values = { fullName: str(formData, "fullName"), email: str(formData, "email"), phone: str(formData, "phone") };
  const parsed = signupSchema.safeParse({ ...values, password: str(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!(await allowIp("signup", 10, 3600))) return { message: TOO_MANY, values };

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.code === "weak_password") return { fieldErrors: { password: [error.message] }, values };
    if (error.code === "over_email_send_rate_limit") {
      return { message: "Too many sign-up emails were sent. Please wait a few minutes and try again.", values };
    }
    return { message: "We couldn't create your account. Please try again.", values };
  }

  // Email confirmation switched off in Supabase: already signed in.
  if (data.session) redirect(next);

  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const values = { email: str(formData, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  // Password guessing: per visitor and per account
  if (!(await allowIp("login", 20, 900)) || !(await allow("login-email", parsed.data.email, 8, 900))) {
    return { message: "Too many login attempts. Please wait 15 minutes, or reset your password.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { message: "unconfirmed", values };
    }
    if (error.status === 429) return { message: "Too many attempts. Please wait a minute and try again.", values };
    return { message: "Incorrect email or password.", values };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function resendConfirmation(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) return { message: "Enter a valid email address first." };
  if (!(await allowIp("resend", 10, 3600)) || !(await allow("resend-email", parsed.data.email, 3, 3600))) return { message: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/dashboard` },
  });
  if (error?.status === 429) return { message: "Please wait a minute before requesting another email." };
  // Same answer whether or not the account exists (privacy)
  return { ok: true, message: "If that account needs confirming, a new link is on its way." };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const values = { email: str(formData, "email") };
  const parsed = emailOnlySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!(await allowIp("reset", 10, 3600)) || !(await allow("reset-email", parsed.data.email, 3, 3600))) return { message: TOO_MANY, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { message: "Please wait a minute before requesting another email.", values };

  // Same answer whether or not the account exists (privacy)
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password.", values };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: str(formData, "password"), confirm: str(formData, "confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login?error=link");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: ["Choose a password different from your old one."] } };
    if (error.code === "weak_password") return { fieldErrors: { password: [error.message] } };
    return { message: "We couldn't update your password. Please request a new reset link." };
  }
  redirect("/dashboard?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
