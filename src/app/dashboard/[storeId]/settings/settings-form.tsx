"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateStoreSettings } from "@/actions/settings";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/fields";
import { Section } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImageField } from "@/components/dashboard/image-field";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/cn";

const COLOURS = ["#0b6e4f", "#1d4ed8", "#7c3aed", "#be185d", "#b4472b", "#c2410c", "#a16207", "#1b1814"];

type Values = Record<string, string>;

export function SettingsForm({ storeId, storeAddress, initial, logo, hero }: {
  storeId: string;
  storeAddress: string;
  initial: Values;
  logo: { path: string | null; url: string | null };
  hero: { path: string | null; url: string | null };
}) {
  const [state, action] = useActionState(updateStoreSettings, initialFormState);
  const [uploads, setUploads] = useState(0);
  const [colour, setColour] = useState(initial.brandColor);
  const v = (k: string) => state.values?.[k] ?? initial[k];
  const e = (k: string) => state.fieldErrors?.[k];
  const track = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1));

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="storeId" value={storeId} />

      <Section title="Store details">
        <Field label="Store name" name="name" required maxLength={80} defaultValue={v("name")} errors={e("name")} />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Store address</p>
          <p className="rounded-lg bg-paper px-3 py-2.5 text-sm text-muted">{storeAddress} <span className="text-xs">· can&apos;t be changed</span></p>
        </div>
        <TextareaField
          label="About your store"
          name="description"
          optional
          maxLength={2000}
          placeholder="e.g. Quality sneakers and bags delivered across Accra. Same-day delivery for orders before 2pm."
          defaultValue={v("description")}
          errors={e("description")}
          hint="Shown on your storefront. One or two sentences works best."
        />
      </Section>

      <Section title="Contact" description="Customers use these to reach you.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="WhatsApp number" name="whatsappNumber" type="tel" inputMode="tel" placeholder="024 123 4567" defaultValue={v("whatsappNumber")} errors={e("whatsappNumber")} hint="Adds a 'Chat on WhatsApp' button." />
          <Field label="Phone number" name="contactPhone" type="tel" inputMode="tel" placeholder="020 123 4567" defaultValue={v("contactPhone")} errors={e("contactPhone")} hint="Optional." />
        </div>
        <Field label="Email" name="email" type="email" inputMode="email" defaultValue={v("email")} errors={e("email")} hint="Optional." />
        <Field label="Shop address or area" name="address" maxLength={300} placeholder="e.g. Osu, Oxford Street, Accra" defaultValue={v("address")} errors={e("address")} hint="Optional. Leave empty if you only deliver." />
      </Section>

      <Section title="Branding" description="Make your storefront look like your business.">
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageField name="logoPath" label="Logo" storeId={storeId} folder="branding" initialPath={logo.path} initialUrl={logo.url} maxDimension={512} hint="Square works best. JPG or PNG." onUploadingChange={track} />
          <ImageField name="heroPath" label="Banner photo" storeId={storeId} folder="branding" initialPath={hero.path} initialUrl={hero.url} maxDimension={1920} aspect="wide" hint="Wide photo for the top of your store." onUploadingChange={track} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Brand colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColour(c)}
                className={cn("h-9 w-9 rounded-full border-2 transition-transform", colour === c ? "scale-110 border-ink" : "border-transparent")}
                style={{ backgroundColor: c }}
                aria-label={`Use colour ${c}`}
                aria-pressed={colour === c}
              />
            ))}
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted">
              <input type="color" value={colour} onChange={(ev) => setColour(ev.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line-strong bg-surface" aria-label="Custom colour" />
              Custom
            </label>
          </div>
          <input type="hidden" name="brandColor" value={colour} />
        </fieldset>
        <Field label="Banner headline" name="heroTitle" maxLength={120} placeholder="e.g. Step into something new" defaultValue={v("heroTitle")} errors={e("heroTitle")} hint="Optional." />
        <Field label="Banner text" name="heroSubtitle" maxLength={300} placeholder="e.g. Order in seconds. Delivery across Greater Accra." defaultValue={v("heroSubtitle")} errors={e("heroSubtitle")} hint="Optional." />
      </Section>

      <Section title="Social media" description="Your username or a full link.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram" name="instagram" placeholder="@yourshop" autoCapitalize="none" defaultValue={v("instagram")} errors={e("instagram")} />
          <Field label="TikTok" name="tiktok" placeholder="@yourshop" autoCapitalize="none" defaultValue={v("tiktok")} errors={e("tiktok")} />
          <Field label="Facebook" name="facebook" placeholder="yourshop" autoCapitalize="none" defaultValue={v("facebook")} errors={e("facebook")} />
          <Field label="X (Twitter)" name="x" placeholder="@yourshop" autoCapitalize="none" defaultValue={v("x")} errors={e("x")} />
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        {uploads > 0 && <span className="text-sm text-muted">Waiting for upload…</span>}
        <SubmitButton disabled={uploads > 0} pendingText="Saving…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
