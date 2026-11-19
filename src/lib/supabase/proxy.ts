import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthApiError } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

// Refreshes the login session on every request and tells us who the user is.
// Returns the response with updated auth cookies attached.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookieOptions: { domain: env.cookieDomain },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getClaims():
  // getClaims() is what refreshes an expired session.
  const { data, error } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  // A broken or expired login that can't be refreshed (e.g. after a long Paystack payment,
  // or a wrong computer clock) would make every database request fail and pages show
  // "not found". Drop it so the visitor simply continues signed out.
  if (error && isAuthApiError(error) && error.status >= 400 && error.status < 500) {
    const stale = request.cookies.getAll().filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
    if (stale.length) {
      stale.forEach((c) => request.cookies.delete(c.name));
      response = NextResponse.next({ request });
      stale.forEach((c) => response.cookies.set(c.name, "", { maxAge: 0, path: "/", domain: env.cookieDomain }));
    }
  }

  return { response, userId };
}

// Copies refreshed auth cookies onto a redirect/rewrite response.
export function withSessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
