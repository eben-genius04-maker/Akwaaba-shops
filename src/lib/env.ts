// Central place for public settings. Fails loudly if something is missing,
// instead of producing confusing errors later.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, ""),
  rootDomain: required("NEXT_PUBLIC_ROOT_DOMAIN", process.env.NEXT_PUBLIC_ROOT_DOMAIN).toLowerCase(),
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  // "false" until your own domain is connected (e.g. while on *.vercel.app, which can't
  // do shop subdomains): shop links then use akwaaba-shops.vercel.app/s/kofishoes
  storeSubdomains: process.env.NEXT_PUBLIC_STORE_SUBDOMAINS !== "false",
};

export const PLATFORM_NAME = "Akwaaba Shops";
