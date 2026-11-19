import { NextResponse, type NextRequest } from "next/server";
import { expireUnpaidOrders } from "@/lib/payments";
import { serverEnv } from "@/lib/server-env";

// Optional backup for pg_cron: cancels online orders not paid in time.
// Call with header "Authorization: Bearer <CRON_SECRET>" (Vercel Cron does this automatically).
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  await expireUnpaidOrders();
  return NextResponse.json({ ok: true });
}
