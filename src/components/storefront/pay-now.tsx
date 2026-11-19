"use client";

import { useActionState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/forms";

// Sends the customer to Paystack (the server action redirects on success)
export function PayNowButton({ action, token, storeSlug }: { action: (s: FormState, fd: FormData) => Promise<FormState>; token: string; storeSlug: string }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="storeSlug" value={storeSlug} />
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-(--store) px-6 font-medium text-(--store-ink) shadow-sm hover:opacity-90 disabled:opacity-60 sm:w-auto">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Opening Paystack…" : "Pay now"}
      </button>
      {state.message && !state.ok && <p className="text-sm text-danger" role="alert">{state.message}</p>}
    </form>
  );
}
