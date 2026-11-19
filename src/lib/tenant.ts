import { env } from "@/lib/env";

// Must match the stores_slug_not_reserved rule in the database.
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "dashboard", "platform", "auth", "login",
  "signup", "register", "mail", "email", "support", "help", "blog", "docs",
  "status", "static", "assets", "cdn", "store", "stores", "shop", "s", "dev",
  "staging", "test", "demo-admin", "billing", "account", "settings",
]);

// 3–40 characters: lowercase letters, numbers and hyphens, not starting/ending with a hyphen.
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

// kofishoes.akwaabashops.com → "kofishoes"; akwaabashops.com → null
export function getStoreSlugFromHost(host: string | null): string | null {
  if (!host || !env.storeSubdomains) return null;
  const h = host.toLowerCase();
  const root = env.rootDomain;
  if (h === root || h === `www.${root}` || !h.endsWith(`.${root}`)) return null;

  const sub = h.slice(0, -(root.length + 1));
  if (sub.includes(".") || RESERVED_SLUGS.has(sub) || !SLUG_PATTERN.test(sub)) return null;
  return sub;
}

// Public address of a store, e.g. https://kofishoes.akwaabashops.com
export function storeUrl(slug: string): string {
  if (!env.storeSubdomains) return storePathUrl(slug);
  const protocol = env.siteUrl.startsWith("https") ? "https:" : "http:";
  return `${protocol}//${slug}.${env.rootDomain}`;
}

// Backup address that works without subdomains: https://akwaabashops.com/s/kofishoes
export function storePathUrl(slug: string): string {
  return `${env.siteUrl}/s/${slug}`;
}

// Paths that belong to the platform, not to a storefront
export const PLATFORM_PATHS = ["/dashboard", "/platform", "/login", "/signup", "/forgot-password", "/reset-password", "/check-email", "/auth", "/invite", "/account", "/track"];
