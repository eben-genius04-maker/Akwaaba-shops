import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

// Supabase client for Client Components (runs in the browser).
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookieOptions: { domain: env.cookieDomain },
  });
}
