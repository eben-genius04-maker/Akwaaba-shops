"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resendConfirmation, signIn } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initialFormState);
  const [resendState, resendAction] = useActionState(resendConfirmation, initialFormState);
  const unconfirmed = state.message === "unconfirmed";

  return (
    <div className="space-y-5">
      {unconfirmed ? (
        <Alert tone="warning" title="Please confirm your email first">
          <p>We sent a confirmation link when you signed up. Open it, then log in.</p>
          <form action={resendAction} className="mt-2">
            <input type="hidden" name="email" value={state.values?.email ?? ""} />
            <SubmitButton variant="secondary" size="sm" pendingText="Sending…">
              Send a new link
            </SubmitButton>
          </form>
          {resendState.message && <p className="mt-2 font-medium">{resendState.message}</p>}
        </Alert>
      ) : (
        state.message && <Alert tone="danger">{state.message}</Alert>
      )}

      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />
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
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
          trailing={
            <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          }
        />
        <SubmitButton className="w-full" size="lg" pendingText="Logging in…">
          Log in
        </SubmitButton>
      </form>
    </div>
  );
}
