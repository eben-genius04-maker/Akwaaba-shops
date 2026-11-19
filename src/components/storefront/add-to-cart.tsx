"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart, MAX_QTY } from "./cart";
import { storeHref, useStore } from "./store-context";

export function AddToCart({ product }: {
  product: { id: string; slug: string; name: string; price: number; image: string | null; stock: number };
}) {
  const { slug, base } = useStore();
  const { lines, add } = useCart(slug);
  const router = useRouter();
  const inCart = lines.find((l) => l.productId === product.id)?.quantity ?? 0;
  const max = Math.max(0, Math.min(MAX_QTY, product.stock) - inCart);
  const [qty, setQty] = useState(1);
  const q = Math.min(Math.max(1, qty), Math.max(1, max));

  function addItems(thenCheckout: boolean) {
    const r = add({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, stock: product.stock }, q);
    if (r.added === 0) {
      toast.error(r.limit === "full" ? "Your cart is full (50 different items max)." : "You already have all we have in stock in your cart.");
      return;
    }
    setQty(1);
    if (thenCheckout) {
      router.push(storeHref(base, "/cart"));
      return;
    }
    toast.success(r.limit ? `Added ${r.added}: that's all we have in stock.` : `${product.name} added to cart`, {
      action: { label: "View cart", onClick: () => router.push(storeHref(base, "/cart")) },
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" id="qty-label">Quantity</span>
        <div className="inline-flex items-center rounded-full border border-line-strong bg-surface" role="group" aria-labelledby="qty-label">
          <button type="button" onClick={() => setQty(q - 1)} disabled={q <= 1} className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" aria-label="Fewer">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{q}</span>
          <button type="button" onClick={() => setQty(q + 1)} disabled={q >= max} className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" aria-label="More">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {inCart > 0 && <span className="text-sm text-muted">{inCart} in your cart</span>}
      </div>
      {max === 0 ? (
        <p className="rounded-lg bg-paper px-4 py-3 text-sm text-muted">You have all available stock in your cart.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => addItems(false)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-(--store) px-6 font-medium text-(--store-ink) shadow-sm hover:opacity-90">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" /> Add to cart
          </button>
          <button type="button" onClick={() => addItems(true)} className="inline-flex h-12 items-center justify-center rounded-full border border-ink px-6 font-medium hover:bg-ink hover:text-paper">
            Buy now
          </button>
        </div>
      )}
    </div>
  );
}
