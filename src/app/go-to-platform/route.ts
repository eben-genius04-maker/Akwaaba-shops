import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/forms";

// Sends visitors from a store subdomain (kofishoes.akwaabashops.com/dashboard)
// to the same page on the main site. proxy.ts rewrites those requests here.
// Done in a route rather than in proxy.ts because Next.js can shorten proxy
// redirects to a relative path, which would loop on the subdomain.
export function GET(request: NextRequest) {
  // After a rewrite, request.nextUrl is still the URL the visitor asked for.
  const { pathname, search } = request.nextUrl;
  const path = pathname === "/go-to-platform" ? "/" : safeNextPath(pathname + search, "/");
  return new Response(null, { status: 307, headers: { Location: `${env.siteUrl}${path}` } });
}
