"use client";

import { useActionState } from "react";
import { updatePassword } from "@/actions/auth";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirm}
      />
      <SubmitButton className="w-full" size="lg" pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
