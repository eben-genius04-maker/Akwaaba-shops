import type { z } from "zod";
import { env } from "@/lib/env";

// Shape returned by every form Server Action, read with useActionState.
export type FormState = {
  ok?: boolean;
  message?: string;              // general error or success message
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>; // echo back what the user typed (never passwords)
};

export const initialFormState: FormState = {};

export function fieldErrorsFrom(error: z.ZodError): FormState["fieldErrors"] {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

// Only allow redirects to this site: a path ("/dashboard"), or a full address on
// our own domain or a store subdomain ("https://kofishoes.akwaabashops.com/checkout").
// Anything else falls back (prevents open redirects).
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next) return fallback;
  if (next.startsWith("/")) {
    return next.startsWith("//") || next.startsWith("/\\") ? fallback : next;
  }
  try {
    const url = new URL(next);
    const host = url.host.toLowerCase();
    const root = env.rootDomain;
    if ((url.protocol === "https:" || url.protocol === "http:") && (host === root || host.endsWith(`.${root}`)) && !url.username && !url.password) {
      return url.toString();
    }
  } catch {
    // not a URL
  }
  return fallback;
}

// Was the person sent to log in from a shop (checkout, order, account) rather than to manage a store?
export function isShopperNext(next: string): boolean {
  return /\/(checkout|account|order\/)/.test(next) && !next.startsWith("/dashboard");
}
