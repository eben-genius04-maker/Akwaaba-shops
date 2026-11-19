"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { checkPaystackConnection, connectPaystack, disconnectPaystack, repairCommission } from "@/actions/paystack";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { initialFormState, type FormState } from "@/lib/forms";
import { formatDateTime } from "@/lib/format";

type Connection = { mode: "test" | "live"; last4: string; broken: boolean; connectedAt: string | null; webhookAt: string | null };

export function PaystackPanel({ storeId, platformReady, feePercent, webhookUrl, connection, viewerIsAdmin = false }: {
  storeId: string; platformReady: boolean; feePercent: number; webhookUrl: string; connection: Connection | null; viewerIsAdmin?: boolean;
}) {
  const [replacing, setReplacing] = useState(false);
  const fee = feePercent.toLocaleString("en-GH", { maximumFractionDigits: 2 });

  return (
    <section className="rounded-2xl border border-line bg-surface" aria-labelledby="paystack-h">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="paystack-h" className="font-semibold">Your Paystack account</h2>
          <p className="mt-0.5 text-sm text-muted">MoMo (MTN, Telecel, AirtelTigo) and card payments go straight into your own Paystack account.</p>
        </div>
        {connection && (
          connection.broken ? <Badge tone="danger">Paused</Badge> : <Badge tone={connection.mode === "live" ? "success" : "warning"}>{connection.mode === "live" ? "Live" : "Test mode"}</Badge>
        )}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {connection?.broken && (
          <div role="alert" className="flex gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-danger">Online payments are paused</p>
              <p className="text-ink/80">The &ldquo;Akwaaba Shops commission&rdquo; subaccount in your Paystack was changed or deleted. Restore it to accept MoMo and card again.</p>
              <ActionForm action={repairCommission} hidden={{ storeId }}>
                <Button type="submit" size="sm">Restore commission split</Button>
              </ActionForm>
            </div>
          </div>
        )}

        {connection && !replacing ? (
          <>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-medium">Connected{connection.connectedAt ? ` ${formatDateTime(connection.connectedAt)}` : ""}</p>
                <p className="text-muted">Keys checked with Paystack · Ghana (GHS) account · secret key ending <span className="font-mono">…{connection.last4}</span>, stored encrypted</p>
                {connection.mode === "test" && <p className="mt-1 text-warning">Test keys: payments use Paystack&apos;s test MoMo and cards, so no real money moves. Replace them with your live keys when you&apos;re ready to sell.</p>}
              </div>
            </div>

            <div className="rounded-xl bg-paper p-4 text-sm">
              <p className="font-medium">Webhook (recommended)</p>
              <p className="mt-1 text-muted">
                In Paystack, open <strong>Settings → API Keys &amp; Webhooks</strong> and paste this as the <strong>{connection.mode === "live" ? "Live" : "Test"} Webhook URL</strong>. It confirms payments even if a customer closes the page early.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-xs">{webhookUrl}</code>
                <CopyButton text={webhookUrl} label="Copy" icon={<Copy className="h-4 w-4" aria-hidden="true" />} />
              </div>
              <p className="mt-2 text-xs text-muted">{connection.webhookAt ? `Last message from Paystack: ${formatDateTime(connection.webhookAt)}` : "No message from Paystack yet."}</p>
            </div>

            <p className="flex items-start gap-2 text-sm text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Akwaaba Shops keeps <strong className="text-ink">{fee}%</strong> of each online payment through a subaccount we created in your Paystack named
                &ldquo;Akwaaba Shops commission&rdquo;. Please don&apos;t edit or delete it, or online payments pause. Paystack&apos;s own fee comes out of your share. Pay on delivery has no fees.
              </span>
            </p>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <ActionForm action={checkPaystackConnection} hidden={{ storeId }}>
                <Button type="submit" variant="secondary" size="sm"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Check connection</Button>
              </ActionForm>
              <Button type="button" variant="secondary" size="sm" onClick={() => setReplacing(true)}>
                <KeyRound className="h-4 w-4" aria-hidden="true" /> Replace keys
              </Button>
              <ActionForm
                action={disconnectPaystack}
                hidden={{ storeId }}
                confirm={{ title: "Disconnect Paystack?", body: "Your keys are deleted and online payments switch off. Pay on delivery switches on.", confirmLabel: "Disconnect", danger: true }}
              >
                <Button type="submit" variant="ghost" size="sm" className="text-danger">Disconnect</Button>
              </ActionForm>
            </div>
          </>
        ) : (
          <ConnectForm storeId={storeId} platformReady={platformReady} viewerIsAdmin={viewerIsAdmin} fee={fee} onCancel={connection ? () => setReplacing(false) : undefined} onDone={() => setReplacing(false)} />
        )}
      </div>
    </section>
  );
}

function ConnectForm({ storeId, platformReady, viewerIsAdmin, fee, onCancel, onDone }: { storeId: string; platformReady: boolean; viewerIsAdmin: boolean; fee: string; onCancel?: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await connectPaystack(prev, fd);
    if (r.message) {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    }
    if (r.ok) onDone();
    return r;
  }, initialFormState);

  if (!platformReady && viewerIsAdmin) {
    // The platform owner sees what's missing (store owners just see "coming soon")
    return (
      <div className="space-y-2 rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm">
        <p className="font-semibold">Platform admin: Paystack isn&apos;t set up on the server yet</p>
        <p>
          Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>, <code className="font-mono text-xs">PAYSTACK_KEYS_ENCRYPTION_KEY</code>,{" "}
          <code className="font-mono text-xs">PLATFORM_PAYSTACK_SETTLEMENT_BANK</code> and <code className="font-mono text-xs">PLATFORM_PAYSTACK_ACCOUNT_NUMBER</code> to{" "}
          <code className="font-mono text-xs">.env.local</code> (and Vercel), then restart. See README → &ldquo;Paystack setup&rdquo;. After that, this page shows the
          boxes for the Public and Secret key.
        </p>
      </div>
    );
  }
  if (!platformReady) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm">
        <p className="text-muted">Online payments aren&apos;t switched on for Akwaaba Shops yet. Until then, customers pay on delivery.</p>
        <Badge tone="warning">Coming soon</Badge>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate autoComplete="off">
      <input type="hidden" name="storeId" value={storeId} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>
          Log in to your Paystack dashboard (or create a free business account){" "}
          <a href="https://dashboard.paystack.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-ink underline">dashboard.paystack.com <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>.
        </li>
        <li>Go to <strong className="text-ink">Settings → API Keys &amp; Webhooks</strong>.</li>
        <li>Copy your <strong className="text-ink">Public key</strong> and <strong className="text-ink">Secret key</strong> and paste them below. Use test keys to try it, live keys to sell.</li>
      </ol>
      <Field label="Public key" name="publicKey" placeholder="pk_test_…" autoCapitalize="none" spellCheck={false} defaultValue={state.values?.publicKey} errors={state.fieldErrors?.publicKey} />
      <PasswordField
        label="Secret key"
        name="secretKey"
        placeholder="sk_test_…"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="new-password"
        errors={state.fieldErrors?.secretKey}
        hint="Stored encrypted. Nobody at your store or Akwaaba Shops can view it afterwards."
      />
      <p className="text-xs text-muted">
        When you connect, we create a subaccount in your Paystack called &ldquo;Akwaaba Shops commission&rdquo; that receives {fee}% of each online payment.
      </p>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Checking with Paystack…" : "Connect Paystack"}
        </Button>
      </div>
    </form>
  );
}
