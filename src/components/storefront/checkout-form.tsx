"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { AlertCircle, Banknote, Check, CreditCard, Loader2, MapPin, Package, ShieldCheck } from "lucide-react";
import { getQuote, placeOrder, type Quote } from "@/actions/checkout";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/fields";
import { formatCedis } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";
import type { LatLng } from "@/lib/delivery";
import { useCart } from "./cart";
import { storeHref, useStore } from "./store-context";

const LocationPicker = dynamic(() => import("@/components/maps/location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-xl border border-line-strong bg-paper text-sm text-muted">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading map…
    </div>
  ),
});

export type CheckoutConfig = {
  deliveryEnabled: boolean;
  method: "zones" | "distance";
  freeDeliveryMin: number | null;
  maxDistanceKm: number | null;
  note: string | null;
  zones: { id: string; name: string; description: string | null; fee: number }[];
  payOnDelivery: boolean;
  codMaxAmount: number | null;
  prepaid: boolean;
};

export type SavedAddress = {
  id: string; label: string; name: string; phone: string; digitalAddress: string; landmark: string;
  area: string; city: string; lat: number | null; lng: number | null; isDefault: boolean;
};

type Fields = { name: string; phone: string; email: string; digitalAddress: string; landmark: string; area: string; city: string; notes: string; addressLabel: string };

function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface" aria-labelledby={`step-${n}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={`step-${n}`} className="flex items-center gap-3 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-(--store) text-xs text-(--store-ink)">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

export function CheckoutForm({ config, customer, addresses, loginHref }: {
  config: CheckoutConfig;
  customer: { name: string; phone: string; email: string } | null;
  addresses: SavedAddress[];
  loginHref: string;
}) {
  const { slug, base } = useStore();
  const { lines, clear } = useCart(slug);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const initialAddress = addresses.find((a) => a.isDefault) ?? null;
  const zoneFor = (area: string) => config.zones.find((z) => z.name.trim().toLowerCase() === area.trim().toLowerCase())?.id ?? "";

  const [f, setF] = useState<Fields>({
    name: initialAddress?.name || customer?.name || "",
    phone: initialAddress?.phone || customer?.phone || "",
    email: customer?.email ?? "",
    digitalAddress: initialAddress?.digitalAddress ?? "",
    landmark: initialAddress?.landmark ?? "",
    area: initialAddress?.area ?? "",
    city: initialAddress?.city ?? "",
    notes: "",
    addressLabel: "Home",
  });
  const [addressId, setAddressId] = useState<string>(initialAddress?.id ?? "new");
  const [zoneId, setZoneId] = useState<string>(initialAddress ? zoneFor(initialAddress.area) : "");
  const [pin, setPin] = useState<LatLng | null>(initialAddress?.lat != null && initialAddress.lng != null ? { lat: initialAddress.lat, lng: initialAddress.lng } : null);
  const [showMap, setShowMap] = useState(config.method === "distance" || !!pin);
  const [payment, setPayment] = useState<"pay_on_delivery" | "prepaid">(config.payOnDelivery ? "pay_on_delivery" : "prepaid");
  const [saveAddress, setSaveAddress] = useState(!!customer && addresses.length === 0);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const [placed, setPlaced] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof Fields) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (k: string) => errors[k];

  function chooseAddress(id: string) {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (!a) {
      setF((s) => ({ ...s, digitalAddress: "", landmark: "", area: "", city: "" }));
      setPin(null);
      setMapKey((k) => k + 1);
      return;
    }
    setF((s) => ({ ...s, name: a.name || s.name, phone: a.phone || s.phone, digitalAddress: a.digitalAddress, landmark: a.landmark, area: a.area, city: a.city }));
    setPin(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null);
    if (a.lat != null) setShowMap(true);
    const z = zoneFor(a.area);
    if (z) setZoneId(z);
    setMapKey((k) => k + 1); // re-centre the map on the saved pin
  }

  // ---- Live delivery fee ----
  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const itemsKey = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  const deliveryKey = config.method === "zones" ? zoneId : pin ? `${pin.lat},${pin.lng}` : "";
  const quoteKey = itemsKey && deliveryKey ? `${itemsKey}|${deliveryKey}` : "";
  const [quote, setQuote] = useState<{ key: string; value: Quote } | null>(null);
  const latest = useRef("");

  useEffect(() => {
    if (!quoteKey) return;
    latest.current = quoteKey;
    const t = setTimeout(async () => {
      const value = await getQuote(slug, items, config.method === "zones" ? zoneId : null, config.method === "distance" ? pin?.lat ?? null : null, config.method === "distance" ? pin?.lng ?? null : null);
      if (latest.current === quoteKey) setQuote({ key: quoteKey, value });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quoteKey captures items, zone and pin
  }, [quoteKey, slug]);

  if (!hydrated || placed) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {placed ? "Opening your order…" : "Loading checkout…"}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
        <p className="font-medium">Your cart is empty</p>
        <Link href={storeHref(base, "/")} className="mt-5 inline-flex h-11 items-center rounded-full bg-(--store) px-6 font-medium text-(--store-ink)">Continue shopping</Link>
      </div>
    );
  }

  const q = quote && quote.key === quoteKey ? quote.value : null;
  const quoting = !!quoteKey && !q;
  const localSubtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const subtotal = q?.ok ? q.subtotal : localSubtotal;
  const total = q?.ok ? q.total : null;
  const codBlocked = config.codMaxAmount !== null && total !== null && total > config.codMaxAmount;
  const hasIssues = !!(q && !q.ok && q.issues?.length);
  const canPay = payment === "pay_on_delivery" ? config.payOnDelivery && !codBlocked : config.prepaid;
  const ready = !!q?.ok && canPay && !placing;

  let feeText: ReactNode;
  if (!config.deliveryEnabled) feeText = <span className="text-danger">Not available</span>;
  else if (!quoteKey) feeText = <span className="text-muted">{config.method === "zones" ? "Choose your area" : "Pin your location"}</span>;
  else if (quoting) feeText = <Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-label="Working out delivery fee" />;
  else if (q?.ok) feeText = q.deliveryFee === 0 ? <span className="font-medium text-success">Free</span> : formatCedis(q.deliveryFee);
  else feeText = <span className="text-muted">—</span>;

  function submit() {
    setFormError(null);
    setErrors({});
    startPlacing(async () => {
      const r = await placeOrder(slug, {
        ...f,
        zoneId: config.method === "zones" ? zoneId : "",
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        paymentMethod: payment,
        saveAddress: !!customer && addressId === "new" && saveAddress,
        items,
      });
      if (r.ok) {
        setPlaced(true);
        clear();
        // Online payment: off to Paystack. Otherwise (or if Paystack couldn't start) the tracking page.
        if (r.payUrl) window.location.href = r.payUrl;
        else router.replace(`${storeHref(base, `/order/${r.token}`)}?new=1`);
        return;
      }
      setErrors(r.fieldErrors ?? {});
      setFormError(r.message ?? "Please check your details.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div ref={topRef} className="mt-6 scroll-mt-32 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {formError && (
          <div role="alert" className="flex gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {formError}
              {hasIssues || formError.includes("cart") ? <> <Link href={storeHref(base, "/cart")} className="font-medium underline">Review cart</Link></> : null}
            </span>
          </div>
        )}

        {/* 1. Customer */}
        <Step n={1} title="Your details" aside={!customer && <a href={loginHref} className="text-sm font-medium underline">Log in</a>}>
          {!customer && <p className="-mt-1 text-sm text-muted">No account needed. Log in to use your saved addresses and see all your orders.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" autoComplete="name" value={f.name} onChange={set("name")} errors={err("name")} />
            <Field label="Phone number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" value={f.phone} onChange={set("phone")} errors={err("phone")} hint="The rider calls this number." />
          </div>
          <Field label={payment === "prepaid" ? "Email" : "Email (optional)"} name="email" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set("email")} errors={err("email")} hint={payment === "prepaid" ? "Needed for online payment: your receipt is sent here." : "For your order receipt and updates."} />
        </Step>

        {/* 2. Delivery */}
        <Step n={2} title="Delivery">
          {!config.deliveryEnabled && (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">This store isn&apos;t taking delivery orders right now. Please check back later.</p>
          )}

          {addresses.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Deliver to</legend>
              {addresses.map((a) => (
                <label key={a.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3", addressId === a.id ? "border-(--store)" : "border-line hover:border-line-strong")}>
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => chooseAddress(a.id)} className="mt-1 accent-(--store)" />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{a.label}</span>
                    {a.isDefault && <span className="ml-2 text-xs text-muted">Default</span>}
                    <span className="block truncate text-muted">{[a.digitalAddress, a.landmark, a.area].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              ))}
              <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm font-medium", addressId === "new" ? "border-(--store)" : "border-line hover:border-line-strong")}>
                <input type="radio" name="address" checked={addressId === "new"} onChange={() => chooseAddress("new")} className="accent-(--store)" />
                A new address
              </label>
            </fieldset>
          )}

          {config.method === "zones" && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Your area</legend>
              {err("zoneId") && <p className="mb-2 text-xs font-medium text-danger">{err("zoneId")![0]}</p>}
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {config.zones.map((z) => (
                  <label key={z.id} className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-xl border-2 p-3 text-sm", zoneId === z.id ? "border-(--store) bg-(--store)/5" : "border-line hover:border-line-strong")}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="zone" value={z.id} checked={zoneId === z.id} onChange={() => setZoneId(z.id)} className="mt-0.5 accent-(--store)" />
                      <span>
                        <span className="font-medium">{z.name}</span>
                        {z.description && <span className="block text-xs text-muted">{z.description}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{z.fee === 0 ? "Free" : formatCedis(z.fee)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Not sure? Pick the closest area. The store may adjust the fee if it&apos;s very different.</p>
            </fieldset>
          )}

          <div className="space-y-2">
            {config.method === "distance" ? (
              <>
                <p className="text-sm font-medium">Your delivery location</p>
                <p className="-mt-1 text-xs text-muted">Tap <strong>Use my location</strong> if you&apos;re at the delivery address, or drop the pin on the map.{config.maxDistanceKm ? ` This store delivers up to ${config.maxDistanceKm} km away.` : ""}</p>
              </>
            ) : (
              !showMap && (
                <button type="button" onClick={() => setShowMap(true)} className="inline-flex items-center gap-2 text-sm font-medium underline">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> Add a map pin (optional, helps the rider)
                </button>
              )
            )}
            {showMap && <LocationPicker key={mapKey} value={pin} onChange={setPin} height={280} label="Delivery location" invalid={!!err("pin")} />}
            {err("pin") && <p className="text-xs font-medium text-danger">{err("pin")![0]}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Digital address (optional)" name="digitalAddress" autoCapitalize="characters" placeholder="GA-123-4567" value={f.digitalAddress} onChange={set("digitalAddress")} errors={err("digitalAddress")} hint="Your GhanaPost GPS address." />
            <Field label="Area / town" name="area" placeholder="e.g. Teshie" value={f.area} onChange={set("area")} errors={err("area")} />
          </div>
          <TextareaField
            label="Directions for the rider"
            name="landmark"
            rows={2}
            maxLength={300}
            placeholder="e.g. Blue gate opposite Total filling station, second house on the left"
            value={f.landmark}
            onChange={set("landmark")}
            errors={err("landmark")}
            hint="Needed if you don't have a digital address."
          />
          {customer && addressId === "new" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-(--store)" />
                Save this address for next time
              </label>
              {saveAddress && (
                <input value={f.addressLabel} onChange={set("addressLabel")} maxLength={40} aria-label="Address name" placeholder="Home" className="h-9 w-32 rounded-lg border border-line-strong bg-surface px-3 text-sm" />
              )}
            </div>
          )}
          {config.note && <p className="rounded-lg bg-paper px-4 py-3 text-sm text-muted">{config.note}</p>}
        </Step>

        {/* 3. Payment */}
        <Step n={3} title="Payment">
          <div className="space-y-2" role="radiogroup" aria-label="Payment method">
            {config.payOnDelivery && (
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4", payment === "pay_on_delivery" ? "border-(--store)" : "border-line", codBlocked && "cursor-not-allowed opacity-60")}>
                <input type="radio" name="payment" checked={payment === "pay_on_delivery"} onChange={() => setPayment("pay_on_delivery")} disabled={codBlocked} className="mt-1 accent-(--store)" />
                <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-(--store)" aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-medium">Pay on delivery</span>
                  <span className="block text-muted">
                    {codBlocked ? `Only for orders up to ${formatCedis(config.codMaxAmount!)}.` : "Pay the rider with cash or MoMo when your order arrives."}
                  </span>
                </span>
              </label>
            )}
            {config.prepaid && (
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4", payment === "prepaid" ? "border-(--store)" : "border-line")}>
                <input type="radio" name="payment" checked={payment === "prepaid"} onChange={() => setPayment("prepaid")} className="mt-1 accent-(--store)" />
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-(--store)" aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-medium">Pay now with MoMo or card</span>
                  <span className="block text-muted">MTN MoMo, Telecel Cash, AirtelTigo Money, Visa or Mastercard, securely through Paystack.</span>
                </span>
              </label>
            )}
            {payment === "prepaid" && !f.email.trim() && (
              <p className="text-sm text-warning">Add your email in step 1: Paystack sends your receipt there.</p>
            )}
            {!config.payOnDelivery && !config.prepaid && (
              <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">This store isn&apos;t accepting orders online yet. Please contact them on WhatsApp.</p>
            )}
          </div>
          <TextareaField label="Note for the store (optional)" name="notes" rows={2} maxLength={1000} placeholder="e.g. Please call when you arrive" value={f.notes} onChange={set("notes")} errors={err("notes")} />
        </Step>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Order summary">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Your order</h2>
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 text-sm">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(l.image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="m-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                  )}
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-paper">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="tabular-nums">{formatCedis(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{formatCedis(subtotal)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery{q?.ok && q.distanceKm !== null ? ` (${q.distanceKm} km)` : ""}</dt>
              <dd className="tabular-nums">{feeText}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-semibold tabular-nums" aria-live="polite">{total !== null ? formatCedis(total) : "—"}</dd>
            </div>
          </dl>

          {q && !q.ok && (
            <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
              {q.issues?.length ? <>Some items in your cart changed. <Link href={storeHref(base, "/cart")} className="font-medium underline">Review cart</Link></> : q.deliveryError ?? q.message}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-(--store) font-medium text-(--store-ink) shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {placing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {placing ? "Placing order…" : total !== null ? `${payment === "prepaid" ? "Pay" : "Place order"} · ${formatCedis(total)}` : payment === "prepaid" ? "Pay" : "Place order"}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Prices and delivery are checked by the store&apos;s system.
          </p>
        </div>
      </aside>
    </div>
  );
}
