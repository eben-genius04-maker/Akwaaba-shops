"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { adjustDeliveryFee } from "@/actions/orders";
import { initialFormState, type FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function FeeAdjust({ storeId, orderId, current }: { storeId: string; orderId: string; current: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await adjustDeliveryFee(prev, fd);
    if (r.message) {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    }
    if (r.ok) setOpen(false);
    return r;
  }, initialFormState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink print:hidden">
        <Pencil className="h-3 w-3" aria-hidden="true" /> Change delivery fee
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 space-y-3 rounded-xl bg-paper p-3 print:hidden">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="New delivery fee" name="fee" inputMode="decimal" prefix="GH₵" defaultValue={state.values?.fee ?? String(current)} errors={state.fieldErrors?.fee} autoFocus />
      <Field label="Reason for the customer (optional)" name="note" maxLength={300} placeholder="e.g. Your location is outside Osu" defaultValue={state.values?.note} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>Save fee</Button>
      </div>
    </form>
  );
}
