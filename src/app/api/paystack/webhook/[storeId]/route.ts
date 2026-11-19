import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreSecret, verifyAndRecord } from "@/lib/payments";
import { validSignature } from "@/lib/paystack";

// Each store pastes https://akwaabashops.com/api/paystack/webhook/{storeId} into its
// own Paystack dashboard. Paystack signs every message with that store's secret key.
export async function POST(request: NextRequest, { params }: RouteContext<"/api/paystack/webhook/[storeId]">) {
  const { storeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return new NextResponse(null, { status: 404 });

  const raw = await request.text();
  if (raw.length > 100_000) return new NextResponse(null, { status: 413 });
  const secret = await getStoreSecret(storeId);
  if (!secret || !validSignature(secret, raw, request.headers.get("x-paystack-signature"))) {
    return new NextResponse(null, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  await createAdminClient().rpc("record_paystack_webhook", { p_store_id: storeId });

  // Don't trust the message body for money: look the payment up with Paystack ourselves
  const reference = event.data?.reference;
  if (reference && (event.event === "charge.success" || event.event === "charge.failed")) {
    await verifyAndRecord(reference, storeId);
  }
  return NextResponse.json({ received: true });
}
