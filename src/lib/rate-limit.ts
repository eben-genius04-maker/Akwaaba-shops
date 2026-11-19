import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Slows down abuse: password guessing, fake sign-ups, checkout spam.
// Counters live in the database (works across all servers); keys are hashed,
// so no emails or IP addresses are stored. If the check itself fails, we let
// the request through rather than block real customers.

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

// On Vercel, x-real-ip / x-forwarded-for are set by Vercel itself (visitors can't fake them)
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function allow(name: string, id: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  const key = "rl:" + createHash("sha256").update(`${name}:${id.toLowerCase()}`).digest("hex").slice(0, 40);
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    return data !== false;
  } catch (e) {
    console.error("rate limit check failed", e);
    return true;
  }
}

// Convenience: limit by the visitor's IP address
export async function allowIp(name: string, limit: number, windowSeconds: number): Promise<boolean> {
  return allow(name, await clientIp(), limit, windowSeconds);
}
