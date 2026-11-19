import { NextResponse, type NextRequest } from "next/server";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";
import { getStoreSlugFromHost, PLATFORM_PATHS } from "@/lib/tenant";
import { safeNextPath } from "@/lib/forms";

// Runs before every page request:
//  1. Refreshes the login session.
//  2. Store subdomains (kofishoes.akwaabashops.com) show that store's storefront.
//  3. Quick login checks for the dashboard (pages re-check properly).
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const slug = getStoreSlugFromHost(request.headers.get("host"));

  const isPath = (p: string) => pathname === p || pathname.startsWith(p + "/");

  // ---- Store subdomain ----
  if (slug) {
    // Dashboard, login etc. live on the main domain
    if (PLATFORM_PATHS.some(isPath)) {
      const url = request.nextUrl.clone();
      url.pathname = "/go-to-platform";
      return withSessionCookies(response, NextResponse.rewrite(url, { request }));
    }
    const url = request.nextUrl.clone();
    url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
    return withSessionCookies(response, NextResponse.rewrite(url, { request }));
  }

  // ---- Main domain ----
  if (!userId && (isPath("/dashboard") || isPath("/platform") || isPath("/account") || isPath("/reset-password"))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return withSessionCookies(response, NextResponse.redirect(login));
  }

  // Already logged in: go where they were heading (e.g. back to a shop's checkout)
  if (userId && (isPath("/login") || isPath("/signup"))) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return withSessionCookies(response, NextResponse.redirect(new URL(next, request.url)));
  }

  return response;
}

export const config = {
  // Skip static files and images
  // Static files (incl. the service worker, offline page and app manifest) skip the proxy,
  // so they're served as-is on every address, including store subdomains
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml)$).*)"],
};
