"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { initialFormState, type FormState } from "@/lib/forms";
import { Button } from "@/components/ui/button";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

// A small form for one-click actions (delete, hide, revoke…). Shows the result as a
// toast, and can ask "Are you sure?" first.
export function ActionForm({
  action,
  children,
  hidden,
  confirm,
  className,
}: {
  action: Action;
  children: ReactNode; // the submit button(s)
  hidden?: Record<string, string>;
  confirm?: { title: string; body?: ReactNode; confirmLabel: string; danger?: boolean };
  className?: string;
}) {
  // The toast is shown as soon as the action finishes, so it still appears when
  // the item disappears from the page (e.g. a deleted row).
  const [, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.message) {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    }
    return result;
  }, initialFormState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();

  return (
    <>
      <form
        id={formId}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !dialogRef.current?.open) {
            e.preventDefault();
            dialogRef.current?.showModal();
          }
        }}
      >
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <fieldset disabled={pending} className="contents">{children}</fieldset>
      </form>
      {confirm && (
        <dialog
          ref={dialogRef}
          className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
        >
          <div className="space-y-2 p-6">
            <h2 className="text-lg font-semibold">{confirm.title}</h2>
            {confirm.body && <div className="text-sm text-muted">{confirm.body}</div>}
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant={confirm.danger ? "danger" : "primary"}
              onClick={() => setTimeout(() => dialogRef.current?.close(), 0)}
            >
              {confirm.confirmLabel}
            </Button>
          </div>
        </dialog>
      )}
    </>
  );
}

// Shows a one-time toast (e.g. "Product saved") passed from the server page.
export function FlashToast({ message, tone = "success" }: { message?: string; tone?: "success" | "error" }) {
  const shown = useRef(false);
  useEffect(() => {
    if (!message || shown.current) return;
    shown.current = true;
    if (tone === "success") toast.success(message);
    else toast.error(message);
    // Remove ?saved=… from the address bar so a refresh doesn't repeat it
    const url = new URL(window.location.href);
    ["saved", "created", "deleted", "joined"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.toString());
  }, [message, tone]);
  return null;
}
