"use client";

import { useActionState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { inviteMember, type InviteState } from "@/actions/staff";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/alert";

export function InviteForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  const message = state.inviteUrl
    ? `Hi! I've invited you to help manage ${storeName} on Akwaaba Shops. Open this link to join: ${state.inviteUrl}`
    : "";

  return (
    <div className="space-y-4">
      <form ref={form} action={action} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-start" noValidate>
        <input type="hidden" name="storeId" value={storeId} />
        <Field label="Email address" name="email" type="email" inputMode="email" placeholder="name@example.com" defaultValue={state.ok ? "" : state.values?.email} errors={state.fieldErrors?.email} />
        <SelectField label="Role" name="role" defaultValue={state.values?.role ?? "staff"}>
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </SelectField>
        <div className="sm:pt-[26px]">
          <SubmitButton className="h-11 w-full" pendingText="Creating…">Create invite</SubmitButton>
        </div>
      </form>
      {state.message && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      {state.inviteUrl && (
        <Alert tone="success" title={`Invitation ready for ${state.inviteEmail}`}>
          <p>Send them this link. They&apos;ll create an account (or log in) with that email and join your store. It works for 7 days.</p>
          <p className="mt-2 break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-ink">{state.inviteUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={state.inviteUrl} label="Copy link" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#177a43] px-3 text-sm font-medium text-white hover:bg-[#11612f]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Send on WhatsApp
            </a>
          </div>
        </Alert>
      )}
    </div>
  );
}
