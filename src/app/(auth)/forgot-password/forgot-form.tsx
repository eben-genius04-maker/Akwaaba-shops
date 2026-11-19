"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  if (state.ok) {
    return (
      <Alert tone="success" title="Check your email">
        {state.message} The link works for one hour.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
