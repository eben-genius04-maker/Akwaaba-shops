"use client";

import { useActionState } from "react";
import { resendConfirmation } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendConfirmation, initialFormState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="secondary" size="sm" pendingText="Sending…" disabled={!email}>
        Send the link again
      </SubmitButton>
      {state.message && <p className={state.ok ? "text-success" : "text-danger"}>{state.message}</p>}
    </form>
  );
}
