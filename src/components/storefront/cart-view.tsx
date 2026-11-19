"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Minus, Package, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { priceCart, type CartIssue, type PricedCart } from "@/actions/cart";
import { formatCedis } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";
import { useCart, MAX_QTY, type CartLine } from "./cart";
import { storeHref, useStore } from "./store-context";

type Result = { key: string; cart: PricedCart; priceChanged: Set<string> };

const ISSUE_TEXT: Record<CartIssue["problem"], string> = {
  not_found: "No longer available. Please remove it.",
  unavailable: "Not available right now. Please remove it.",
  out_of_stock: "Sold out. Please remove it.",
  insufficient_stock: "Not enough in stock.",
};

export function CartView() {
  const { slug, base } = useStore();
  const { lines, setQuantity, remove, refresh } = useCart(slug);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const latest = useRef("");

  // The cart is read from this browser after the page loads
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const key = useMemo(() => lines.map((l) => `${l.productId}:${l.quantity}`).join(","), [lines]);

  // Re-price from the database whenever the cart changes (short pause while tapping +/−)
  useEffect(() => {
    if (!key) return;
    latest.current = key;
    const snapshot: CartLine[] = lines;
    const t = setTimeout(async () => {
      const cart = await priceCart(slug, snapshot.map((l) => ({ productId: l.productId, quantity: l.quantity })));
      if (latest.current !== key) return; // a newer change is on its way
      const priceChanged = new Set<string>();
      if (cart.ok) {
        const updates = new Map<string, Partial<CartLine>>();
        for (const pl of cart.lines) {
          const local = snapshot.find((l) => l.productId === pl.product_id);
          if (local && Math.abs(local.price - pl.unit_price) > 0.001) priceChanged.add(pl.product_id);
          updates.set(pl.product_id, { name: pl.name, price: pl.unit_price, image: pl.image_url });
        }
        for (const is of cart.issues) {
          if (is.problem === "insufficient_stock" && is.available !== null) updates.set(is.product_id, { stock: is.available });
        }
        refresh(updates);
      }
      setResult({ key, cart, priceChanged });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the cart contents
  }, [key, slug, retry]);

  if (!hydrated) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your cart…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <ShoppingBag className="h-8 w-8 text-muted" aria-hidden="true" />
        <p className="mt-3 font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Browse the shop and tap &ldquo;Add to cart&rdquo;.</p>
        <Link href={storeHref(base, "/")} className="mt-6 inline-flex h-11 items-center rounded-full bg-(--store) px-6 font-medium text-(--store-ink)">
          Continue shopping
        </Link>
      </div>
    );
  }

  const checking = !result || result.key !== key;
  const cart = result?.cart;
  const issues = new Map(cart?.ok ? cart.issues.map((i) => [i.product_id, i]) : []);
  const priced = new Map(cart?.ok ? cart.lines.map((l) => [l.product_id, l]) : []);
  const subtotal = cart?.ok ? cart.subtotal : lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const free = cart?.ok ? cart.freeDeliveryMin : null;
  const hasIssues = issues.size > 0;
  const deliveryOff = cart?.ok && !cart.deliveryEnabled;
  const canCheckout = !checking && cart?.ok && !hasIssues && !deliveryOff && cart.storeActive;
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
      <section aria-label="Items in your cart">
        {hasIssues && !checking && (
          <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Some items need your attention before you can check out.
          </div>
        )}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {lines.map((l) => {
            const issue = issues.get(l.productId);
            const p = priced.get(l.productId);
            const unit = p?.unit_price ?? l.price;
            const href = storeHref(base, `/p/${l.slug}`);
            const max = Math.min(MAX_QTY, l.stock ?? MAX_QTY);
            return (
              <li key={l.productId} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link href={href} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-paper sm:h-24 sm:w-24">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(l.image)} alt="" className={cn("h-full w-full object-cover", issue && issue.problem !== "insufficient_stock" && "opacity-50")} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted"><Package className="h-6 w-6" aria-hidden="true" /></span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={href} className="line-clamp-2 font-medium leading-snug hover:underline">{issue?.name ?? l.name}</Link>
                    <p className="shrink-0 font-semibold tabular-nums">{formatCedis(unit * l.quantity)}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-muted tabular-nums">
                    {formatCedis(unit)} each
                    {result?.priceChanged.has(l.productId) && <span className="ml-2 font-medium text-warning">Price updated</span>}
                  </p>
                  {issue && (
                    <p className="mt-1 text-sm font-medium text-danger">
                      {issue.problem === "insufficient_stock" ? `Only ${issue.available} left.` : ISSUE_TEXT[issue.problem]}
                      {issue.problem === "insufficient_stock" && issue.available !== null && issue.available > 0 && (
                        <button type="button" onClick={() => setQuantity(l.productId, issue.available!)} className="ml-2 underline">
                          Change to {issue.available}
                        </button>
                      )}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {issue && issue.problem !== "insufficient_stock" ? (
                      <span />
                    ) : (
                      <div className="inline-flex items-center rounded-full border border-line-strong" role="group" aria-label={`Quantity of ${l.name}`}>
                        <button type="button" onClick={() => setQuantity(l.productId, l.quantity - 1)} disabled={l.quantity <= 1} className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label={`One fewer ${l.name}`}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">{l.quantity}</span>
                        <button type="button" onClick={() => setQuantity(l.productId, l.quantity + 1)} disabled={l.quantity >= max} className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30" aria-label={`One more ${l.name}`}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <button type="button" onClick={() => remove(l.productId)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:text-danger" aria-label={`Remove ${l.name}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href={storeHref(base, "/")} className="mt-4 inline-block text-sm font-medium hover:underline">← Continue shopping</Link>
      </section>

      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Order summary">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items ({count})</dt>
              <dd className="font-medium tabular-nums">{checking ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-label="Checking prices" /> : formatCedis(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="text-muted">{free !== null && subtotal >= free ? <span className="font-medium text-success">Free</span> : "At checkout"}</dd>
            </div>
          </dl>
          {free !== null && free > 0 && !checking && (
            <FreeDeliveryProgress subtotal={subtotal} threshold={free} />
          )}
          <div className="flex justify-between border-t border-line pt-4">
            <span className="font-semibold">Subtotal</span>
            <span className="text-lg font-semibold tabular-nums">{formatCedis(subtotal)}</span>
          </div>

          {cart && !cart.ok && !checking && (
            <p className="text-sm text-danger" role="alert">
              {cart.error}{" "}
              <button type="button" className="underline" onClick={() => { latest.current = ""; setResult(null); setRetry((n) => n + 1); }}>Try again</button>
            </p>
          )}
          {deliveryOff && <p className="text-sm text-warning">This store isn&apos;t taking delivery orders right now.</p>}
          {cart?.ok && !cart.storeActive && <p className="text-sm text-muted">Preview: checkout opens once the store is approved.</p>}

          {canCheckout ? (
            <Link href={storeHref(base, "/checkout")} className="flex h-12 w-full items-center justify-center rounded-full bg-(--store) font-medium text-(--store-ink) shadow-sm hover:opacity-90">
              Checkout
            </Link>
          ) : (
            <button type="button" disabled className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-(--store) font-medium text-(--store-ink) opacity-50">
              {checking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {checking ? "Checking your cart…" : "Checkout"}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function FreeDeliveryProgress({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="flex items-center gap-2 text-sm">
        <Truck className="h-4 w-4 shrink-0 text-(--store)" aria-hidden="true" />
        {left === 0 ? <span className="font-medium">You get free delivery!</span> : <span>Add <strong className="tabular-nums">{formatCedis(left)}</strong> more for free delivery</span>}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Progress to free delivery">
        <div className="h-full rounded-full bg-(--store) transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
