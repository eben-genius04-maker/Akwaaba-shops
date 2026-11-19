import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

// Minimal Paystack API client. Every call uses the STORE's secret key.

export class PaystackError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function call<T>(secret: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.paystackApiUrl()}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new PaystackError("We couldn't reach Paystack. Please try again.");
  }
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) throw new PaystackError(json?.message || `Paystack error (${res.status})`, res.status);
  return json.data as T;
}

export const KEY_PATTERNS = {
  public: /^pk_(test|live)_[A-Za-z0-9]{10,100}$/,
  secret: /^sk_(test|live)_[A-Za-z0-9]{10,100}$/,
};

// A cheap read-only call that only works with a valid secret key. Returns the
// account's currencies (e.g. ["GHS"]), so we can make sure it's a Ghana account.
export async function checkSecretKey(secret: string): Promise<string[]> {
  const balances = await call<{ currency: string; balance: number }[]>(secret, "/balance");
  return (balances ?? []).map((b) => b.currency);
}

type Subaccount = { subaccount_code: string; account_number: string; settlement_bank: string; active?: boolean; business_name: string };

// Creates the platform's commission subaccount inside the store's Paystack account
export async function createCommissionSubaccount(secret: string, storeName: string): Promise<string> {
  const data = await call<Subaccount>(secret, "/subaccount", {
    method: "POST",
    body: {
      business_name: serverEnv.platformCommissionName(),
      settlement_bank: serverEnv.platformSettlementBank(),
      account_number: serverEnv.platformAccountNumber(),
      percentage_charge: 99, // overridden on every payment by transaction_charge
      description: `Akwaaba Shops platform commission for ${storeName}. Do not edit or delete: online payments pause if it changes.`,
    },
  });
  return data.subaccount_code;
}

// Does the commission subaccount still pay the platform?
export async function commissionSubaccountIntact(secret: string, code: string): Promise<boolean> {
  try {
    const sub = await call<Subaccount>(secret, `/subaccount/${encodeURIComponent(code)}`);
    return sub.account_number === serverEnv.platformAccountNumber() && sub.active !== false;
  } catch (e) {
    if (e instanceof PaystackError && e.status === 404) return false;
    throw e;
  }
}

export async function initializeTransaction(secret: string, body: {
  email: string; amount: number; currency: string; reference: string; callback_url: string;
  subaccount?: string; transaction_charge?: number; bearer?: "account" | "subaccount"; metadata?: Record<string, unknown>;
}): Promise<{ authorization_url: string; reference: string }> {
  return call(secret, "/transaction/initialize", { method: "POST", body });
}

export type VerifiedTransaction = {
  status: string; reference: string; amount: number; currency: string; channel: string | null;
  gateway_response?: string; subaccount?: { subaccount_code?: string } | null;
};

export async function verifyTransaction(secret: string, reference: string): Promise<VerifiedTransaction> {
  return call(secret, `/transaction/verify/${encodeURIComponent(reference)}`);
}

// Paystack signs each webhook with the account's secret key (HMAC-SHA512 of the raw body)
export function validSignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
