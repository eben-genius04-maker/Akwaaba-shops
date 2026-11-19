import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { amountInput } from "@/lib/delivery";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import { PaymentForm } from "./payment-form";
import { PaystackPanel } from "./paystack-panel";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ params }: PageProps<"/dashboard/[storeId]/payments">) {
  const { storeId } = await params;
  const { store, user } = await requireStoreAccess(storeId);
  if (store.role !== "owner") notFound();

  const supabase = await createClient();
  const { data: p } = await supabase.from("store_payment_settings").select("*").eq("store_id", storeId).single();
  if (!p) notFound();
  const connected = !!p.paystack_subaccount_code;
  const healthy = connected && p.paystack_status === "connected";

  return (
    <>
      <PageHeader title="Payments" description="Choose how customers can pay for their orders." />
      <div className="space-y-6">
        <PaystackPanel
          storeId={storeId}
          platformReady={serverEnv.paymentsConfigured()}
          feePercent={Number(p.platform_fee_percent)}
          webhookUrl={`${env.siteUrl}/api/paystack/webhook/${storeId}`}
          viewerIsAdmin={user.isPlatformAdmin}
          connection={connected ? {
            mode: (p.paystack_mode ?? "test") as "test" | "live",
            last4: p.paystack_key_last4 ?? "????",
            broken: p.paystack_status === "split_broken",
            connectedAt: p.subaccount_connected_at,
            webhookAt: p.paystack_webhook_at,
          } : null}
        />
        <PaymentForm
          key={p.updated_at}
          storeId={storeId}
          initial={{
            codEnabled: p.cod_enabled ? "on" : "off",
            codMaxAmount: amountInput(p.cod_max_amount),
            prepaidEnabled: p.prepaid_enabled ? "on" : "off",
          }}
          onlineReady={healthy}
          testMode={p.paystack_mode === "test"}
        />
      </div>
    </>
  );
}
