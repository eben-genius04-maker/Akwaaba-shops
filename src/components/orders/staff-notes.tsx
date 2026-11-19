"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { saveStaffNotes } from "@/actions/orders";
import { initialFormState, type FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function StaffNotes({ storeId, orderId, initial }: { storeId: string; orderId: string; initial: string }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveStaffNotes(prev, fd);
    if (r.message) {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    }
    return r;
  }, initialFormState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <textarea
        name="staffNotes"
        rows={3}
        maxLength={2000}
        defaultValue={state.values?.staffNotes ?? initial}
        aria-label="Team notes"
        placeholder="Only your team sees this, e.g. Rider: Kojo, 024 000 0000"
        className={cn(inputClass, "h-auto py-2 text-sm")}
      />
      {state.fieldErrors?.staffNotes && <p className="text-xs font-medium text-danger">{state.fieldErrors.staffNotes[0]}</p>}
      <div className="flex justify-end print:hidden">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save note"}</Button>
      </div>
    </form>
  );
}
