"use client";

import { useActionState } from "react";
import { signUp } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";

export function SignupForm({ next, email = "" }: { next: string; email?: string }) {
  const [state, action] = useActionState(signUp, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email ?? email}
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="024 123 4567"
        hint="Optional. So we can reach you about your store."
        defaultValue={state.values?.phone}
        errors={state.fieldErrors?.phone}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to use Akwaaba Shops honestly and lawfully.
      </p>
    </form>
  );
}
