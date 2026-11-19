import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

// Full-access database client for trusted server code only (payments, webhooks).
// Never import this into a component that runs in the browser.
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
