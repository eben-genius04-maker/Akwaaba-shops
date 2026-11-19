"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { saveProduct } from "@/actions/catalogue";
import { Field } from "@/components/ui/field";
import { SelectField, TextareaField, Toggle } from "@/components/ui/fields";
import { Section } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { initialFormState } from "@/lib/forms";

export type ProductInitial = {
  id?: string; name: string; slug: string; description: string; price: string; categoryId: string;
  stockQuantity: string; deliverySize: "small" | "medium" | "large"; isActive: boolean; isAvailable: boolean; isFeatured: boolean;
  images: { path: string; url: string }[];
};

export function ProductForm({ storeId, initial, categories }: {
  storeId: string; initial: ProductInitial; categories: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveProduct, initialFormState);
  const [uploading, setUploading] = useState(false);
  const onBusy = useCallback((b: boolean) => setUploading(b), []);
  const v = (k: keyof ProductInitial) => state.values?.[k] ?? String(initial[k] ?? "");
  const e = (k: string) => state.fieldErrors?.[k];
  const on = (k: "isActive" | "isAvailable" | "isFeatured") => (state.values?.[k] ? state.values[k] === "on" : initial[k]);

  useEffect(() => {
    if (state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="storeId" value={storeId} />
      {initial.id && <input type="hidden" name="productId" value={initial.id} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Section title="Product">
            <Field label="Name" name="name" required maxLength={150} placeholder="e.g. Classic White Sneakers" defaultValue={v("name")} errors={e("name")} />
            <TextareaField label="Description" name="description" optional rows={6} maxLength={10000} placeholder="Size, colour, material, what's included…" defaultValue={v("description")} errors={e("description")} />
          </Section>

          <Section title="Photos">
            <PhotoManager storeId={storeId} initial={initial.images} onBusyChange={onBusy} />
          </Section>

          <Section title="Price and stock">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Price" name="price" required inputMode="decimal" placeholder="0.00" prefix="GH₵" defaultValue={v("price")} errors={e("price")} />
              <Field label="Quantity in stock" name="stockQuantity" required inputMode="numeric" placeholder="0" defaultValue={v("stockQuantity")} errors={e("stockQuantity")} hint="Goes down automatically when someone orders." />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Visibility">
            <Toggle name="isActive" label="Show in store" description="Off = hidden from customers." defaultChecked={on("isActive")} />
            <Toggle name="isAvailable" label="Can be ordered" description="Turn off to pause orders without hiding it." defaultChecked={on("isAvailable")} />
            <Toggle name="isFeatured" label="Featured" description="Shown first on your store's home page." defaultChecked={on("isFeatured")} />
          </Section>

          <Section title="Organise">
            <SelectField label="Category" name="categoryId" defaultValue={v("categoryId")} errors={e("categoryId")}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectField>
            <SelectField label="Delivery size" name="deliverySize" defaultValue={v("deliverySize")} errors={e("deliverySize")} hint="Bigger items can have an extra delivery charge.">
              <option value="small">Small (fits in a bag)</option>
              <option value="medium">Medium (needs a box)</option>
              <option value="large">Large (furniture, appliances)</option>
            </SelectField>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-muted hover:text-ink">Advanced</summary>
              <div className="mt-4">
                <Field label="Link name" name="slug" maxLength={160} autoCapitalize="none" placeholder="Created from the name" defaultValue={v("slug")} errors={e("slug")} hint="Used in the product's web address." />
              </div>
            </details>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        {uploading && <span className="text-sm text-muted">Uploading photos…</span>}
        <SubmitButton disabled={uploading} pendingText="Saving…">{initial.id ? "Save changes" : "Add product"}</SubmitButton>
      </div>
    </form>
  );
}
