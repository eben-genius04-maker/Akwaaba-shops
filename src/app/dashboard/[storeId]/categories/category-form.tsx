"use client";

import { useActionState, useState } from "react";
import { saveCategory } from "@/actions/catalogue";
import { Field } from "@/components/ui/field";
import { TextareaField, Toggle } from "@/components/ui/fields";
import { Section } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "@/components/dashboard/image-field";
import { initialFormState } from "@/lib/forms";

export type CategoryInitial = {
  id?: string; name: string; slug: string; description: string; isActive: boolean; imagePath: string | null; imageUrl: string | null;
};

export function CategoryForm({ storeId, initial }: { storeId: string; initial: CategoryInitial }) {
  const [state, action] = useActionState(saveCategory, initialFormState);
  const [uploading, setUploading] = useState(false);
  const v = (k: keyof CategoryInitial) => state.values?.[k] ?? String(initial[k] ?? "");

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="storeId" value={storeId} />
      {initial.id && <input type="hidden" name="categoryId" value={initial.id} />}
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Section>
        <Field label="Name" name="name" required maxLength={80} placeholder="e.g. Sneakers" defaultValue={v("name")} errors={state.fieldErrors?.name} />
        <TextareaField label="Description" name="description" optional rows={3} maxLength={1000} defaultValue={v("description")} errors={state.fieldErrors?.description} />
        <ImageField name="imagePath" label="Picture" storeId={storeId} folder="categories" initialPath={initial.imagePath} initialUrl={initial.imageUrl} maxDimension={800} hint="Optional. Shown on your store's home page." onUploadingChange={setUploading} />
        <Toggle name="isActive" label="Show in store" description="Turn off to hide this category from customers." defaultChecked={state.values?.isActive ? state.values.isActive === "on" : initial.isActive} />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted hover:text-ink">Advanced</summary>
          <div className="mt-4">
            <Field label="Link name" name="slug" maxLength={100} autoCapitalize="none" placeholder="Created from the name" defaultValue={v("slug")} errors={state.fieldErrors?.slug} hint="Used in the web address, e.g. /categories/sneakers. Leave empty to create it from the name." />
          </div>
        </details>
      </Section>
      <div className="flex justify-end gap-3">
        <SubmitButton disabled={uploading} pendingText="Saving…">{initial.id ? "Save changes" : "Create category"}</SubmitButton>
      </div>
    </form>
  );
}
