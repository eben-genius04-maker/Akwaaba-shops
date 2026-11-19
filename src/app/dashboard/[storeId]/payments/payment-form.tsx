"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, Loader2 } from "lucide-react";
import { savePaymentSettings } from "@/actions/payments";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/fields";
import { Section } from "@/components/ui/layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";

export function PaymentForm({ storeId, initial, onlineReady, testMode }: {
  storeId: string;
  initial: Record<string, string>;
  onlineReady: boolean; // Paystack connected and the commission split is in place
  testMode: boolean;
}) {
  // Toast here, not in an effect: the page remounts this form after a save
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await savePaymentSettings(prev, fd);
    if (result.message) {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    }
    return result;
  }, initialFormState);
  const v = (k: string) => state.values?.[k] ?? initial[k];
  const e = (k: string) => state.fieldErrors?.[k];

  const connected = onlineReady;
  const [cod, setCod] = useState(v("codEnabled") === "on");
  const [prepaid, setPrepaid] = useState(connected && v("prepaidEnabled") === "on");
  const noWayToPay = !cod && !(connected && prepaid);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="storeId" value={storeId} />

      <Section title="Pay on delivery" description="The customer pays your rider in cash or MoMo when the order arrives.">
        <div className="flex items-start gap-3">
          <Banknote className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="flex-1">
            <Toggle name="codEnabled" label="Allow pay on delivery" description="No fees from Akwaaba Shops." checked={cod} onCheckedChange={setCod} />
          </div>
        </div>
        {cod && (
          <Field
            label="Only for orders up to"
            name="codMaxAmount"
            inputMode="decimal"
            prefix="GH₵"
            placeholder="No limit"
            defaultValue={v("codMaxAmount")}
            errors={e("codMaxAmount")}
            className="sm:max-w-xs"
            hint={
              connected
                ? "Bigger orders must be paid online first. Leave empty for no limit."
                : "Leave empty for no limit. Until you connect Paystack, customers can't order above this amount."
            }
          />
        )}
        {/* Keep the saved limit when pay on delivery is switched off */}
        {!cod && <input type="hidden" name="codMaxAmount" value={v("codMaxAmount")} />}
      </Section>

      <Section title="MoMo and card payments" description="Customers pay when they order, through your Paystack account.">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="flex-1">
            <Toggle
              name="prepaidEnabled"
              label="Accept MoMo and card payments"
              description={connected ? (testMode ? "Test mode: no real money moves. Switch to live keys to sell." : "Customers can choose to pay online at checkout.") : "Connect Paystack above first."}
              checked={prepaid}
              onCheckedChange={setPrepaid}
              disabled={!connected}
            />
          </div>
        </div>
      </Section>

      {noWayToPay && (
        <Alert tone="danger" title="Customers need a way to pay">
          Turn on pay on delivery{connected ? " or MoMo and card payments" : ""} before saving.
        </Alert>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        <Button type="submit" disabled={pending || noWayToPay} aria-busy={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save payment settings"}
        </Button>
      </div>
    </form>
  );
}
