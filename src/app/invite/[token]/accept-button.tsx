"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/actions/staff";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";

export function AcceptButton({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <SubmitButton size="lg" className="w-full" pendingText="Joining…">Accept and join</SubmitButton>
    </form>
  );
}
