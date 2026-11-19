"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { changeCommission, changeStoreStatus } from "@/actions/platform";
import { initialFormState, type FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

function useToastAction(fn: (s: FormState, fd: FormData) => Promise<FormState>, after?: (r: FormState) => void) {
  return useActionState(async (prev: FormState, fd: FormData) => {
    const r = await fn(prev, fd);
    if (r.message) {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    }
    after?.(r);
    return r;
  }, initialFormState);
}

export function StoreStatusActions({ storeId, storeName, status }: { storeId: string; storeName: string; status: "pending" | "active" | "suspended" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [, approve, approving] = useToastAction(changeStoreStatus);
  const [suspendState, suspend, suspending] = useToastAction(changeStoreStatus, (r) => r.ok && dialog.current?.close());

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && (
        <form action={approve}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="status" value="active" />
          <Button type="submit" disabled={approving}>
            {approving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {status === "pending" ? "Approve store" : "Reactivate store"}
          </Button>
        </form>
      )}
      {status !== "suspended" && (
        <Button type="button" variant="secondary" className="text-danger" onClick={() => dialog.current?.showModal()}>
          {status === "pending" ? "Reject (suspend)" : "Suspend store"}
        </Button>
      )}
      <dialog ref={dialog} className="m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40">
        <form action={suspend}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="status" value="suspended" />
          <div className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Suspend {storeName}?</h2>
            <p className="text-sm text-muted">The store disappears from customers and can&apos;t take orders. The owner can still log in and sees your reason.</p>
            <label htmlFor="suspend-reason" className="block text-sm font-medium">Reason (shown to the owner)</label>
            <textarea id="suspend-reason" name="reason" rows={3} maxLength={500} className={cn(inputClass, "h-auto py-2")} placeholder="e.g. Products don't match our rules. Please contact support." />
            {suspendState.fieldErrors?.reason && <p className="text-xs font-medium text-danger">{suspendState.fieldErrors.reason[0]}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={suspending}>Suspend</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export function CommissionForm({ storeId, percent }: { storeId: string; percent: number }) {
  const [state, action, pending] = useToastAction(changeCommission);
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <Field label="Commission" name="percent" inputMode="decimal" suffix="%" defaultValue={state.values?.percent ?? String(percent)} errors={state.fieldErrors?.percent} className="w-32" />
      <Button type="submit" variant="secondary" disabled={pending} className="mb-[1px]">Save</Button>
    </form>
  );
}
