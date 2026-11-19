"use client";

import dynamic from "next/dynamic";
import { useActionState, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Bike, Loader2, MapPinned, Route } from "lucide-react";
import { saveDeliverySettings } from "@/actions/delivery";
import { Field } from "@/components/ui/field";
import { TextareaField, Toggle } from "@/components/ui/fields";
import { Section } from "@/components/ui/layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";
import { distanceFee, parseAmount, type LatLng } from "@/lib/delivery";
import { formatCedis } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ZonesManager, type Zone } from "./zones-manager";

// Leaflet only works in the browser
const LocationPicker = dynamic(() => import("@/components/maps/location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-xl border border-line-strong bg-paper text-sm text-muted">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading map…
    </div>
  ),
});

const FORM_ID = "delivery-settings";
const SAMPLE_KM = [2, 5, 10, 15, 25];

type Values = Record<string, string>;

export function DeliveryEditor({ storeId, initial, zones }: { storeId: string; initial: Values; zones: Zone[] }) {
  // Toast here, not in an effect: the page remounts this form after a save
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveDeliverySettings(prev, fd);
    if (result.message) {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    }
    return result;
  }, initialFormState);

  const v = (k: string) => state.values?.[k] ?? initial[k];
  const e = (k: string) => state.fieldErrors?.[k];

  const [enabled, setEnabled] = useState(v("deliveryEnabled") === "on");
  const [method, setMethod] = useState(v("method"));
  const [pin, setPin] = useState<LatLng | null>(
    v("pickupLat") && v("pickupLng") ? { lat: Number(v("pickupLat")), lng: Number(v("pickupLng")) } : null,
  );
  // Live numbers for the fee preview
  const [nums, setNums] = useState({
    baseFee: v("baseFee"), perKmFee: v("perKmFee"), maxDistanceKm: v("maxDistanceKm"), roadFactor: v("roadFactor"),
    mediumSurcharge: v("mediumSurcharge"), largeSurcharge: v("largeSurcharge"),
  });
  const track = (k: keyof typeof nums) => ({
    onChange: (ev: ChangeEvent<HTMLInputElement>) => setNums((n) => ({ ...n, [k]: ev.target.value })),
  });

  const activeZones = zones.filter((z) => z.isActive).length;
  const methodChanged = method !== initial.method;

  return (
    <div className="space-y-6">
      {/* Inputs below join this form with form={FORM_ID}, so the zone forms can sit in between */}
      <form id={FORM_ID} action={action} noValidate>
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="pickupLat" value={pin ? String(pin.lat) : ""} />
        <input type="hidden" name="pickupLng" value={pin ? String(pin.lng) : ""} />
      </form>

      {!enabled && (
        <Alert tone="warning" title="Delivery is paused">
          Customers can browse your store but can&apos;t place orders until you turn delivery back on and save.
        </Alert>
      )}

      <Section title="Delivery">
        <Toggle
          name="deliveryEnabled"
          form={FORM_ID}
          label="Accept delivery orders"
          description="Turn off to pause new orders, e.g. during holidays or when riders are unavailable."
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </Section>

      <Section title="How do you charge for delivery?" description="Pick one. You can switch at any time.">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery pricing method">
          {[
            { value: "zones", icon: MapPinned, title: "By area", body: "List areas like Teshie, Osu or East Legon, each with its own price. The customer picks their area at checkout." },
            { value: "distance", icon: Route, title: "By distance", body: "Set a starting fee plus a price per km. We measure from your shop to the customer's map pin." },
          ].map((m) => (
            <label
              key={m.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors",
                method === m.value ? "border-brand bg-brand-soft/60" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="methodChoice" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="sr-only" />
              <m.icon className={cn("mt-0.5 h-5 w-5 shrink-0", method === m.value ? "text-brand" : "text-muted")} aria-hidden="true" />
              <span>
                <span className="block font-medium">{m.title}</span>
                <span className="mt-1 block text-sm text-muted">{m.body}</span>
              </span>
            </label>
          ))}
        </div>
        {methodChanged && (
          <p className="text-sm font-medium text-warning" role="status">
            Save your settings below to switch checkout to {method === "zones" ? "area" : "distance"} pricing.
          </p>
        )}
      </Section>

      {method === "zones" && (
        <>
          {activeZones === 0 && (
            <Alert tone="warning" title="Add at least one area">
              Customers can&apos;t check out until you have an area they can choose.
            </Alert>
          )}
          <ZonesManager storeId={storeId} zones={zones} />
        </>
      )}

      {/* Kept in the page (just hidden) for area pricing, so its saved values are kept */}
      <div hidden={method !== "distance"} className="space-y-6">
        <Section title="Your shop's location" description="Where your riders start from. Customers don't see this pin.">
          {method === "distance" && <LocationPicker value={pin} onChange={setPin} invalid={!!e("pickupLat")} label="Shop location" />}
          {e("pickupLat") && <p className="text-xs font-medium text-danger">{e("pickupLat")![0]}</p>}
          <Field
            form={FORM_ID}
            label="Pickup address or landmark"
            name="pickupAddress"
            maxLength={300}
            placeholder="e.g. Teshie, near the Palace Mall junction"
            defaultValue={v("pickupAddress")}
            errors={e("pickupAddress")}
            hint="Optional. For your team and riders."
          />
        </Section>

        <Section title="Distance prices" description="Fee = starting fee + (price per km × road distance), rounded up to whole cedis.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field form={FORM_ID} label="Starting fee" name="baseFee" inputMode="decimal" prefix="GH₵" defaultValue={v("baseFee")} errors={e("baseFee")} hint="Charged on every delivery." {...track("baseFee")} />
            <Field form={FORM_ID} label="Price per km" name="perKmFee" inputMode="decimal" prefix="GH₵" defaultValue={v("perKmFee")} errors={e("perKmFee")} {...track("perKmFee")} />
            <Field form={FORM_ID} label="Furthest you deliver" name="maxDistanceKm" inputMode="decimal" suffix="km" placeholder="No limit" defaultValue={v("maxDistanceKm")} errors={e("maxDistanceKm")} hint="Customers further away can't order. Leave empty for no limit." {...track("maxDistanceKm")} />
          </div>
          <details className="group rounded-lg border border-line px-4 py-3" open={!!e("roadFactor")}>
            <summary className="cursor-pointer text-sm font-medium">Advanced: road distance</summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">
                We measure a straight line on the map and multiply it by this number to estimate the distance by road.
                1.30 suits most of Accra. Raise it if your riders often take long detours.
              </p>
              <Field form={FORM_ID} label="Road factor" name="roadFactor" inputMode="decimal" defaultValue={v("roadFactor")} errors={e("roadFactor")} className="max-w-40" {...track("roadFactor")} />
            </div>
          </details>
          <FeePreview nums={nums} />
        </Section>
      </div>

      <Section title="Extra charges and offers">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            form={FORM_ID}
            label="Extra for medium items"
            name="mediumSurcharge"
            inputMode="decimal"
            prefix="GH₵"
            placeholder="0"
            defaultValue={v("mediumSurcharge")}
            errors={e("mediumSurcharge")}
            hint="e.g. a microwave or a big bag."
            {...track("mediumSurcharge")}
          />
          <Field
            form={FORM_ID}
            label="Extra for large items"
            name="largeSurcharge"
            inputMode="decimal"
            prefix="GH₵"
            placeholder="0"
            defaultValue={v("largeSurcharge")}
            errors={e("largeSurcharge")}
            hint="e.g. a fridge, TV or furniture."
            {...track("largeSurcharge")}
          />
        </div>
        <p className="-mt-1 text-xs text-muted">
          Added once per order, based on the biggest item in the cart. You set each product&apos;s size on its product page.
        </p>
        <Field
          form={FORM_ID}
          label="Free delivery for orders from"
          name="freeDeliveryMin"
          inputMode="decimal"
          prefix="GH₵"
          placeholder="Never free"
          defaultValue={v("freeDeliveryMin")}
          errors={e("freeDeliveryMin")}
          hint="Orders at or above this amount (before delivery) get free delivery. Leave empty to always charge."
        />
        <TextareaField
          form={FORM_ID}
          label="Delivery note for customers"
          name="deliveryNote"
          optional
          rows={2}
          maxLength={500}
          placeholder="e.g. Same-day delivery in Accra for orders before 2pm. Outside Accra: 1–2 days."
          defaultValue={v("deliveryNote")}
          errors={e("deliveryNote")}
          hint="Shown at checkout."
        />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        {methodChanged && <span className="hidden text-sm text-muted sm:inline">Pricing method changed</span>}
        <Button type="submit" form={FORM_ID} disabled={pending} aria-busy={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save delivery settings"}
        </Button>
      </div>
    </div>
  );
}

// Example fees so the owner can sanity-check their prices
function FeePreview({ nums }: { nums: Record<string, string> }) {
  const base = parseAmount(nums.baseFee);
  const perKm = parseAmount(nums.perKmFee);
  if (base === null || perKm === null) return null;
  const maxKm = parseAmount(nums.maxDistanceKm);
  const factorRaw = Number(nums.roadFactor);
  const roadFactor = factorRaw >= 1 && factorRaw <= 2 ? factorRaw : 1.3;
  const medium = parseAmount(nums.mediumSurcharge) ?? 0;
  const large = parseAmount(nums.largeSurcharge) ?? 0;
  const pricing = { baseFee: base, perKmFee: perKm, maxDistanceKm: maxKm };

  return (
    <div className="rounded-xl bg-paper p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bike className="h-4 w-4 text-brand" aria-hidden="true" /> What customers will pay
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Road distance</th>
              <th className="pb-2 font-medium">Small items</th>
              {medium > 0 && <th className="pb-2 font-medium">Medium</th>}
              {large > 0 && <th className="pb-2 font-medium">Large</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {SAMPLE_KM.map((km) => {
              const fee = distanceFee(km, pricing);
              return (
                <tr key={km} className="border-t border-line">
                  <td className="py-2">{km} km</td>
                  {fee === null ? (
                    <td className="py-2 text-muted" colSpan={3}>Too far, can&apos;t order</td>
                  ) : (
                    <>
                      <td className="py-2">{formatCedis(fee)}</td>
                      {medium > 0 && <td className="py-2">{formatCedis(distanceFee(km, pricing, medium)!)}</td>}
                      {large > 0 && <td className="py-2">{formatCedis(distanceFee(km, pricing, large)!)}</td>}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Road distance ≈ straight-line distance × {roadFactor.toFixed(2)}. Free-delivery offers still apply.
      </p>
    </div>
  );
}
