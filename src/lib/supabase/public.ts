import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

// Signed-out database client (ignores the visitor's login cookies). For public data
// where the address itself is the key, e.g. an order's tracking link.
export function createPublicClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
