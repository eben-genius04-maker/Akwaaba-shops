"use server";

import { revalidatePath } from "next/cache";
import { getStoreAccess, NO_PERMISSION } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { checkSecretKey, commissionSubaccountIntact, createCommissionSubaccount, KEY_PATTERNS, PaystackError } from "@/lib/paystack";
import { getStoreSecret } from "@/lib/payments";
import { serverEnv } from "@/lib/server-env";
import type { FormState } from "@/lib/forms";
import { allow, TOO_MANY } from "@/lib/rate-limit";

const NOT_READY = "Online payments aren't switched on for Akwaaba Shops yet (the platform's payout account isn't set up). Please try again later.";

function refresh(storeId: string) {
  revalidatePath(`/dashboard/${storeId}/payments`);
  revalidatePath(`/dashboard/${storeId}`);
}

// Owner pastes their Paystack keys. We check them with Paystack, create the
// platform's commission subaccount in their account, then store the secret key encrypted.
export async function connectPaystack(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  if (!serverEnv.paymentsConfigured()) return { message: NOT_READY };
  if (!(await allow("paystack-connect", access.store.id, 10, 3600))) return { message: TOO_MANY };

  const publicKey = String(formData.get("publicKey") ?? "").trim();
  const secretKey = String(formData.get("secretKey") ?? "").trim();
  const values = { publicKey }; // never echo the secret key back
  const fieldErrors: Record<string, string[]> = {};
  if (!KEY_PATTERNS.public.test(publicKey)) fieldErrors.publicKey = ["Paste your Public key. It starts with pk_test_ or pk_live_."];
  if (!KEY_PATTERNS.secret.test(secretKey)) fieldErrors.secretKey = ["Paste your Secret key. It starts with sk_test_ or sk_live_."];
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const mode = publicKey.startsWith("pk_live_") ? "live" : "test";
  if (secretKey.startsWith("sk_live_") !== (mode === "live")) {
    return { fieldErrors: { secretKey: ["Both keys must be test keys, or both live keys."] }, values };
  }

  let currencies: string[] = [];
  try {
    currencies = await checkSecretKey(secretKey);
  } catch (e) {
    if (e instanceof PaystackError && (e.status === 401 || e.status === 403)) {
      return { fieldErrors: { secretKey: ["Paystack didn't accept this secret key. Copy it again from your Paystack dashboard."] }, values };
    }
    return { message: e instanceof PaystackError ? e.message : "We couldn't reach Paystack. Please try again.", values };
  }

  // Stores sell in cedis, so the Paystack account must be able to take GHS
  if (currencies.length && !currencies.includes("GHS")) {
    return { message: `This Paystack account is set up for ${currencies.join(", ")}. Akwaaba Shops needs a Ghana (GHS) Paystack account.`, values };
  }

  let splitCode: string;
  try {
    splitCode = await createCommissionSubaccount(secretKey, access.store.name);
  } catch (e) {
    return { message: `Paystack couldn't set up the commission split: ${e instanceof Error ? e.message : "unknown error"}. Your Paystack account may need to be activated for ${mode} payments.`, values };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("connect_store_paystack", {
    p_store_id: access.store.id,
    p_public_key: publicKey,
    p_secret_encrypted: encryptSecret(secretKey),
    p_secret_last4: secretKey.slice(-4),
    p_mode: mode,
    p_split_code: splitCode,
  });
  if (error) return { message: "We couldn't save your keys. Please try again.", values };

  refresh(access.store.id);
  return {
    ok: true,
    message: mode === "test"
      ? "Paystack connected in test mode. Your keys are real and the account takes cedis (GHS)."
      : "Paystack connected. Your live keys are real and the account takes cedis (GHS). You can now accept MoMo and card payments.",
  };
}

// "Check connection": are the saved keys still accepted, and is the commission split still in place?
export async function checkPaystackConnection(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  if (!(await allow("paystack-check", access.store.id, 20, 3600))) return { message: TOO_MANY };
  const admin = createAdminClient();
  const [secret, { data: s }] = await Promise.all([
    getStoreSecret(access.store.id),
    admin.from("store_payment_settings").select("paystack_subaccount_code").eq("store_id", access.store.id).single(),
  ]);
  if (!secret || !s?.paystack_subaccount_code) return { message: "Paystack isn't connected." };
  try {
    await checkSecretKey(secret);
  } catch (e) {
    if (e instanceof PaystackError && (e.status === 401 || e.status === 403)) {
      return { message: "Paystack no longer accepts your saved secret key (it may have been changed). Replace your keys." };
    }
    return { message: e instanceof PaystackError ? e.message : "We couldn't reach Paystack. Please try again." };
  }
  const ok = await commissionSubaccountIntact(secret, s.paystack_subaccount_code).catch(() => null);
  if (ok === null) return { message: "We couldn't reach Paystack. Please try again." };
  await admin.rpc("set_paystack_split_status", { p_store_id: access.store.id, p_ok: ok });
  refresh(access.store.id);
  return ok
    ? { ok: true, message: "All good: Paystack accepts your keys and the commission split is in place." }
    : { message: "Your keys work, but the commission subaccount was changed. Online payments are paused until you restore it." };
}

// The commission subaccount was changed or deleted in Paystack: create a fresh one
export async function repairCommission(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  if (!serverEnv.paymentsConfigured()) return { message: NOT_READY };
  const admin = createAdminClient();
  const [secret, { data: keys }, { data: s }] = await Promise.all([
    getStoreSecret(access.store.id),
    admin.from("store_paystack_keys").select("public_key, secret_key_encrypted, mode").eq("store_id", access.store.id).maybeSingle(),
    admin.from("store_payment_settings").select("paystack_key_last4").eq("store_id", access.store.id).single(),
  ]);
  if (!secret || !keys) return { message: "Connect Paystack again with your keys." };
  try {
    const code = await createCommissionSubaccount(secret, access.store.name);
    const { error } = await admin.rpc("connect_store_paystack", {
      p_store_id: access.store.id, p_public_key: keys.public_key, p_secret_encrypted: keys.secret_key_encrypted,
      p_secret_last4: s?.paystack_key_last4 ?? secret.slice(-4), p_mode: keys.mode, p_split_code: code,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return { message: e instanceof Error ? `Couldn't repair: ${e.message}` : "Couldn't repair. Please try again." };
  }
  refresh(access.store.id);
  return { ok: true, message: "Commission split restored. Turn on MoMo and card payments again below." };
}

export async function disconnectPaystack(_: FormState, formData: FormData): Promise<FormState> {
  const access = await getStoreAccess(formData.get("storeId"), ["owner"]);
  if (!access) return { message: NO_PERMISSION };
  const { error } = await createAdminClient().rpc("disconnect_store_paystack", { p_store_id: access.store.id });
  if (error) return { message: "We couldn't disconnect. Please try again." };
  refresh(access.store.id);
  return { ok: true, message: "Paystack disconnected. Your keys were deleted; customers pay on delivery." };
}
