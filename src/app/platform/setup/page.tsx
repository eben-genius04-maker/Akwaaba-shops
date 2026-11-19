import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Go-live checks" };

type Level = "ok" | "warn" | "fail";
type Check = { label: string; level: Level; detail: string };

const isSet = (name: string) => !!process.env[name];

// Reads the live settings (names only, never values) and tests the database,
// so you can confirm a deployment is complete. Admins only (see layout).
export default async function SetupChecks() {
  const checks: { group: string; items: Check[] }[] = [];
  const https = env.siteUrl.startsWith("https://");
  const local = /localhost|127\.0\.0\.1/.test(env.siteUrl + env.rootDomain);
  const vercelApp = env.rootDomain.endsWith(".vercel.app");
  const siteHost = (() => { try { return new URL(env.siteUrl).host; } catch { return ""; } })();

  checks.push({ group: "Website address", items: [
    { label: "Site address", level: https && !local ? "ok" : local ? "warn" : "fail", detail: `${env.siteUrl}${local ? " (local computer: fine for testing only)" : https ? "" : " (must start with https://)"}` },
    { label: "Root domain matches site address", level: siteHost === env.rootDomain || siteHost === `www.${env.rootDomain}` ? "ok" : "fail", detail: `NEXT_PUBLIC_ROOT_DOMAIN = ${env.rootDomain}` },
    env.storeSubdomains
      ? { label: "Shop subdomains", level: vercelApp ? "fail" : "ok", detail: vercelApp ? "vercel.app can't do shop subdomains. Set NEXT_PUBLIC_STORE_SUBDOMAINS=false until your domain is connected." : `On: shops live at name.${env.rootDomain}` }
      : { label: "Shop subdomains", level: "warn", detail: `Off: shops use ${env.siteUrl}/s/name. Turn on after connecting your domain with a wildcard (*.${env.rootDomain}).` },
    env.storeSubdomains && !local
      ? { label: "Login shared across shops", level: env.cookieDomain === `.${env.rootDomain}` ? "ok" : "warn", detail: env.cookieDomain ? `NEXT_PUBLIC_COOKIE_DOMAIN = ${env.cookieDomain} (expected .${env.rootDomain})` : `Set NEXT_PUBLIC_COOKIE_DOMAIN=.${env.rootDomain}` }
      : { label: "Login cookie", level: env.cookieDomain && !env.storeSubdomains ? "warn" : "ok", detail: env.cookieDomain && !env.storeSubdomains ? "Remove NEXT_PUBLIC_COOKIE_DOMAIN while subdomains are off" : "Default" },
  ]});

  // Database
  const db: Check[] = [];
  if (!isSet("SUPABASE_SERVICE_ROLE_KEY")) {
    db.push({ label: "Server database key", level: "fail", detail: "SUPABASE_SERVICE_ROLE_KEY is missing" });
  } else {
    const admin = createAdminClient();
    const probe = await admin.from("stores").select("id", { head: true, count: "exact" });
    db.push({ label: "Server database key", level: probe.error ? "fail" : "ok", detail: probe.error ? `Doesn't work: ${probe.error.message}` : `Works (${probe.count ?? 0} stores)` });
    const latest = await admin.from("rate_limits").select("key", { head: true }).limit(1);
    db.push({ label: "All database migrations applied", level: latest.error ? "fail" : "ok", detail: latest.error ? "The latest migration (phase 11 hardening) is missing. Run all files in supabase/migrations in order." : "Up to date (through phase 11)" });
    const admins = await admin.from("profiles").select("id", { head: true, count: "exact" }).eq("is_platform_admin", true);
    if (!admins.error) db.push({ label: "Platform admins", level: (admins.count ?? 0) > 0 ? "ok" : "warn", detail: `${admins.count ?? 0} admin account(s)` });
  }
  checks.push({ group: "Database", items: db });

  // Payments
  const key = process.env.PAYSTACK_KEYS_ENCRYPTION_KEY ?? "";
  const keyOk = (() => { try { return Buffer.from(key, "base64").length === 32; } catch { return false; } })();
  const api = process.env.PAYSTACK_API_URL;
  checks.push({ group: "Payments (Paystack)", items: [
    { label: "Key-encryption secret", level: keyOk ? "ok" : "fail", detail: keyOk ? "Set (32 bytes). Keep a copy somewhere safe: losing it means every shop re-enters its keys." : key ? "PAYSTACK_KEYS_ENCRYPTION_KEY must be 32 random bytes in base64" : "PAYSTACK_KEYS_ENCRYPTION_KEY is missing" },
    { label: "Your commission payout account", level: isSet("PLATFORM_PAYSTACK_SETTLEMENT_BANK") && isSet("PLATFORM_PAYSTACK_ACCOUNT_NUMBER") ? "ok" : "fail", detail: isSet("PLATFORM_PAYSTACK_SETTLEMENT_BANK") ? `Bank/MoMo code ${process.env.PLATFORM_PAYSTACK_SETTLEMENT_BANK}, account ending ${(process.env.PLATFORM_PAYSTACK_ACCOUNT_NUMBER ?? "").slice(-4) || "?"}` : "PLATFORM_PAYSTACK_SETTLEMENT_BANK / PLATFORM_PAYSTACK_ACCOUNT_NUMBER missing" },
    { label: "Real Paystack", level: !api || api === "https://api.paystack.co" ? "ok" : "fail", detail: !api ? "api.paystack.co" : `PAYSTACK_API_URL points to ${api}: remove it in production` },
  ]});

  checks.push({ group: "Background jobs", items: [
    { label: "Cron secret", level: isSet("CRON_SECRET") ? "ok" : "warn", detail: isSet("CRON_SECRET") ? "Set: the daily backup clean-up of unpaid orders runs" : "CRON_SECRET missing: the daily backup job is refused (pg_cron in Supabase still runs every few minutes)" },
  ]});

  const all = checks.flatMap((g) => g.items);
  const fails = all.filter((c) => c.level === "fail").length;
  const warns = all.filter((c) => c.level === "warn").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Go-live checks</h1>
        <p className="mt-1 text-muted">Confirms this deployment&apos;s settings. Secret values are never shown.</p>
      </div>
      <p className={cn("rounded-2xl px-5 py-4 font-medium", fails ? "bg-danger/10 text-danger" : warns ? "bg-gold-soft" : "bg-brand/10 text-brand")} role="status">
        {fails ? `${fails} thing${fails > 1 ? "s" : ""} to fix before going live` : warns ? `Ready, with ${warns} note${warns > 1 ? "s" : ""}` : "Everything looks ready"}
      </p>
      {checks.map((g) => (
        <section key={g.group} className="rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 font-semibold">{g.group}</h2>
          <ul className="divide-y divide-line">
            {g.items.map((c) => (
              <li key={c.label} className="flex items-start gap-3 px-5 py-3 text-sm">
                {c.level === "ok" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-label="OK" />
                  : c.level === "warn" ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-label="Note" />
                  : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-label="Problem" />}
                <div className="min-w-0">
                  <p className="font-medium">{c.label}</p>
                  <p className="break-words text-muted">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
