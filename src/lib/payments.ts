import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { commissionSubaccountIntact, initializeTransaction, PaystackError, verifyTransaction } from "@/lib/paystack";
import type { Json } from "@/types/database";

// Payment flow, run on the server with full database access.
// Customers and store owners never see a store's secret key.

const SPLIT_RECHECK_MS = 6 * 60 * 60 * 1000; // re-check the commission split every 6 hours

export async function getStoreSecret(storeId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("store_paystack_keys").select("secret_key_encrypted").eq("store_id", storeId).maybeSingle();
  if (!data) return null;
  try {
    return decryptSecret(data.secret_key_encrypted);
  } catch {
    return null;
  }
}

// Cancels online orders that weren't paid in time (stock goes back)
export async function expireUnpaidOrders(): Promise<void> {
  try {
    await createAdminClient().rpc("expire_unpaid_orders");
  } catch {
    // best effort; pg_cron also does this
  }
}

// Confirms the commission subaccount still pays the platform (cached for a few hours)
async function ensureSplitIntact(storeId: string, secret: string, code: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("store_payment_settings").select("paystack_split_checked_at, paystack_status").eq("store_id", storeId).single();
  if (s?.paystack_status === "connected" && s.paystack_split_checked_at && Date.now() - new Date(s.paystack_split_checked_at).getTime() < SPLIT_RECHECK_MS) {
    return true;
  }
  const ok = await commissionSubaccountIntact(secret, code);
  await admin.rpc("set_paystack_split_status", { p_store_id: storeId, p_ok: ok });
  return ok;
}

// Called before placing an online-payment order: is this store able to take it right now?
export async function storeCanTakeOnlinePayment(storeSlug: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("id").eq("slug", storeSlug.toLowerCase()).maybeSingle();
  if (!store) return false;
  const [secret, { data: s }] = await Promise.all([
    getStoreSecret(store.id),
    admin.from("store_payment_settings").select("paystack_subaccount_code, prepaid_enabled").eq("store_id", store.id).single(),
  ]);
  if (!secret || !s?.paystack_subaccount_code || !s.prepaid_enabled) return false;
  try {
    return await ensureSplitIntact(store.id, secret, s.paystack_subaccount_code);
  } catch {
    return false;
  }
}

export type StartResult = { ok: true; url: string } | { ok: false; message: string };

// Creates a Paystack payment for an order and returns the page to send the customer to
export async function startPayment(trackingToken: string, callbackUrl: string): Promise<StartResult> {
  const admin = createAdminClient();
  await expireUnpaidOrders();

  // Check the commission split BEFORE recording a payment attempt
  const { data: order } = await admin.from("orders").select("store_id").eq("tracking_token", trackingToken).maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  const secret = await getStoreSecret(order.store_id);
  const { data: settings } = await admin.from("store_payment_settings").select("paystack_subaccount_code").eq("store_id", order.store_id).single();
  if (!secret || !settings?.paystack_subaccount_code) return { ok: false, message: "This store can't take online payments right now. Please contact them." };
  try {
    if (!(await ensureSplitIntact(order.store_id, secret, settings.paystack_subaccount_code))) {
      return { ok: false, message: "This store can't take online payments right now. Please contact them." };
    }
  } catch (e) {
    return { ok: false, message: e instanceof PaystackError ? e.message : "We couldn't reach Paystack. Please try again." };
  }

  const { data, error } = await admin.rpc("begin_payment", { p_tracking_token: trackingToken });
  if (error || !data) return { ok: false, message: error?.code === "P0001" ? error.message : "We couldn't start the payment. Please try again." };
  const p = data as { reference: string; amount_minor: number; currency: string; email: string; subaccount_code: string; platform_fee_minor: number; order_number: number; store_id: string };

  const fee = Number(p.platform_fee_minor);
  const amount = Number(p.amount_minor);
  try {
    const init = await initializeTransaction(secret, {
      email: p.email,
      amount,
      currency: p.currency,
      reference: p.reference,
      callback_url: callbackUrl,
      // The store's main account keeps amount - commission and pays Paystack's fee;
      // the commission goes to the platform's subaccount.
      ...(fee > 0 && fee < amount ? { subaccount: p.subaccount_code, transaction_charge: amount - fee, bearer: "account" as const } : {}),
      metadata: { order_number: p.order_number, store_id: p.store_id, platform_fee_minor: fee },
    });
    return { ok: true, url: init.authorization_url };
  } catch (e) {
    await admin.rpc("fail_payment", { p_reference: p.reference, p_reason: "initialize_failed" });
    return { ok: false, message: e instanceof PaystackError ? `Paystack: ${e.message}` : "We couldn't start the payment. Please try again." };
  }
}

export type VerifyResult = "paid" | "failed" | "pending" | "unknown";

// Asks Paystack for the real result of a payment and records it. Never trusts the browser.
export async function verifyAndRecord(reference: string, expectedStoreId?: string): Promise<VerifyResult> {
  if (!/^ORD\d+-[A-F0-9]{12}$/.test(reference)) return "unknown";
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("store_id, status, platform_fee").eq("reference", reference).maybeSingle();
  if (!payment || (expectedStoreId && payment.store_id !== expectedStoreId)) return "unknown";
  if (payment.status === "success") return "paid";

  const secret = await getStoreSecret(payment.store_id);
  if (!secret) return "unknown";
  let tx;
  try {
    tx = await verifyTransaction(secret, reference);
  } catch {
    return "pending";
  }

  const data = JSON.parse(JSON.stringify({ status: tx.status, channel: tx.channel, gateway_response: tx.gateway_response ?? null, subaccount: tx.subaccount?.subaccount_code ?? null })) as Json;
  if (tx.status === "success") {
    const { data: r } = await admin.rpc("confirm_payment", {
      p_reference: reference, p_amount_minor: Number(tx.amount), p_currency: tx.currency, p_channel: tx.channel ?? undefined, p_data: data,
    });
    // The commission must have gone to the platform's subaccount; if not, pause online payments
    const { data: s } = await admin.from("store_payment_settings").select("paystack_subaccount_code").eq("store_id", payment.store_id).single();
    if (Number(payment.platform_fee) > 0 && s?.paystack_subaccount_code && tx.subaccount?.subaccount_code !== s.paystack_subaccount_code) {
      await admin.rpc("set_paystack_split_status", { p_store_id: payment.store_id, p_ok: false });
    }
    return (r as { ok?: boolean } | null)?.ok ? "paid" : "failed";
  }
  // "abandoned" just means not finished yet: the customer can still pay
  if (["failed", "reversed"].includes(tx.status)) {
    await admin.rpc("fail_payment", { p_reference: reference, p_reason: tx.gateway_response ?? tx.status, p_data: data });
    return "failed";
  }
  return "pending";
}
