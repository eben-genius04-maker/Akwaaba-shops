"use client";

import { useActionState, useState } from "react";
import { createStore } from "@/actions/store";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";
import { slugify } from "@/lib/format";

export function CreateStoreForm({ rootDomain }: { rootDomain: string }) {
  const [state, action] = useActionState(createStore, initialFormState);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(state.values?.slug));

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field
        label="Store name"
        name="name"
        placeholder="e.g. Kofi Shoes"
        required
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        errors={state.fieldErrors?.name}
      />
      <Field
        label="Store address"
        name="slug"
        placeholder="kofishoes"
        required
        maxLength={40}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={slug}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
        }}
        suffix={`.${rootDomain}`}
        hint="Lowercase letters, numbers and hyphens. This is the link you'll share with customers."
        errors={state.fieldErrors?.slug}
      />
      {slug && !state.fieldErrors?.slug && (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
          Your store will be at <span className="font-medium text-ink">{slug}.{rootDomain}</span>
        </p>
      )}
      <SubmitButton size="lg" className="w-full" pendingText="Creating your store…">
        Create store
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        New stores are reviewed before going live, usually within a day. You can set everything up in the meantime.
      </p>
    </form>
  );
}
