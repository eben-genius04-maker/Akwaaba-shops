import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeUrl } from "@/lib/tenant";
import { env } from "@/lib/env";

// Short tracking link for messages and emails: akwaabashops.com/track/{token}
// → the order page on the store's own address.
export async function GET(_: NextRequest, { params }: RouteContext<"/track/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) return NextResponse.redirect(`${env.siteUrl}/track-not-found`, 307);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_order_by_token", { p_token: token });
  const slug = (data as { store?: { slug?: string } } | null)?.store?.slug;
  if (!slug) return NextResponse.redirect(`${env.siteUrl}/track-not-found`, 307);
  return NextResponse.redirect(`${storeUrl(slug)}/order/${token}`, 307);
}
