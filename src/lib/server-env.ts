import "server-only";

// Secret settings: only ever read on the server, never sent to the browser.
// Read when needed (not at start-up) so pages without payments still work
// if these aren't set yet.

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server setting ${name}. See README → "Paystack setup".`);
  return v;
}

export const serverEnv = {
  serviceRoleKey: () => need("SUPABASE_SERVICE_ROLE_KEY"),
  // 32 random bytes, base64. Encrypts stores' Paystack secret keys.
  paystackKeysEncryptionKey: () => need("PAYSTACK_KEYS_ENCRYPTION_KEY"),
  // Where the platform's commission is paid out (bank or mobile money code + number)
  platformSettlementBank: () => need("PLATFORM_PAYSTACK_SETTLEMENT_BANK"),
  platformAccountNumber: () => need("PLATFORM_PAYSTACK_ACCOUNT_NUMBER"),
  platformCommissionName: () => process.env.PLATFORM_COMMISSION_NAME || "Akwaaba Shops commission",
  paystackApiUrl: () => (process.env.PAYSTACK_API_URL || "https://api.paystack.co").replace(/\/$/, ""),
  cronSecret: () => process.env.CRON_SECRET || null,
  paymentsConfigured: () =>
    !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.PAYSTACK_KEYS_ENCRYPTION_KEY &&
       process.env.PLATFORM_PAYSTACK_SETTLEMENT_BANK && process.env.PLATFORM_PAYSTACK_ACCOUNT_NUMBER),
};
