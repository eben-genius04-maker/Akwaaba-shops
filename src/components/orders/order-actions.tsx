"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, XCircle } from "lucide-react";
import { changeOrderStatus } from "@/actions/orders";
import { initialFormState, type FormState } from "@/lib/forms";
import { NEXT_STEPS, type OrderStatus } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

function useStatusAction() {
  return useActionState(async (prev: FormState, fd: FormData) => {
    const r = await changeOrderStatus(prev, fd);
    if (r.message) {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    }
    return r;
  }, initialFormState);
}

// Big, obvious buttons for the next step, plus Cancel for owners and managers
export function OrderActions({ storeId, orderId, orderNumber, status, canCancel, waitingForPayment, payOnDelivery }: {
  storeId: string; orderId: string; orderNumber: number; status: OrderStatus;
  canCancel: boolean; waitingForPayment: boolean; payOnDelivery: boolean;
}) {
  const [, action, pending] = useStatusAction();
  const [cancelState, cancelAction, cancelling] = useStatusAction();
  const [showNote, setShowNote] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const steps = NEXT_STEPS[status];
  const finished = steps.length === 0;

  if (finished) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 print:hidden" aria-label="Update order">
      <form action={action} className="space-y-3">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="orderId" value={orderId} />
        {waitingForPayment ? (
          <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">Waiting for the customer to pay online. You can confirm once it&apos;s paid.</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            {steps.map((s, i) => (
              <Button
                key={s.status}
                type="submit"
                name="status"
                value={s.status}
                disabled={pending}
                variant={i === 0 ? "primary" : "secondary"}
                size="lg"
                className="sm:flex-1"
              >
                {pending && i === 0 && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {s.status === "delivered" && payOnDelivery ? "Delivered and paid" : s.label}
              </Button>
            ))}
          </div>
        )}
        {!waitingForPayment && (
          showNote ? (
            <div className="space-y-1.5">
              <label htmlFor="status-note" className="text-sm font-medium">Message to the customer (optional)</label>
              <textarea id="status-note" name="note" rows={2} maxLength={500} className={cn(inputClass, "h-auto py-2")} placeholder="e.g. Your rider Kojo will call you in 30 minutes" />
              <p className="text-xs text-muted">Shown on their tracking page with this update.</p>
            </div>
          ) : (
            <button type="button" onClick={() => setShowNote(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
              <MessageSquare className="h-4 w-4" aria-hidden="true" /> Add a message for the customer
            </button>
          )
        )}
      </form>

      {canCancel && (
        <>
          <div className="mt-4 border-t border-line pt-4">
            <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline">
              <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel order
            </button>
          </div>
          <dialog ref={dialog} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40">
            <form
              action={cancelAction}
              onSubmit={(e) => {
                const note = (e.currentTarget.elements.namedItem("note") as HTMLTextAreaElement).value.trim();
                if (note.length >= 3) setTimeout(() => dialog.current?.close(), 0);
              }}
            >
              <input type="hidden" name="storeId" value={storeId} />
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="status" value="cancelled" />
              <div className="space-y-3 p-6">
                <h2 className="text-lg font-semibold">Cancel order #{orderNumber}?</h2>
                <p className="text-sm text-muted">The items go back into stock and the customer sees your reason on their tracking page.</p>
                <label htmlFor="cancel-reason" className="block text-sm font-medium">Reason</label>
                <textarea id="cancel-reason" name="note" rows={2} maxLength={500} required className={cn(inputClass, "h-auto py-2")} placeholder="e.g. Sorry, this item just sold out in the shop" aria-invalid={!!cancelState.fieldErrors?.note || undefined} />
                {cancelState.fieldErrors?.note && <p className="text-xs font-medium text-danger">{cancelState.fieldErrors.note[0]}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">
                <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>Keep order</Button>
                <Button type="submit" variant="danger" disabled={cancelling}>
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Cancel order
                </Button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </section>
  );
}
