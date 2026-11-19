"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";
import { storeHref, useStore } from "./store-context";
import type { CardProduct } from "./product-card";

export function QuickAdd({ product: p }: { product: CardProduct }) {
  const { slug, base } = useStore();
  const { add } = useCart(slug);
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        const r = add({ productId: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, stock: p.stock }, 1);
        if (r.added > 0) {
          toast.success(`${p.name} added to cart`, { action: { label: "View cart", onClick: () => router.push(storeHref(base, "/cart")) } });
        } else {
          toast.error(r.limit === "full" ? "Your cart is full (50 different items max)." : "You already have all we have in stock in your cart.");
        }
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink hover:border-(--store) hover:bg-(--store) hover:text-(--store-ink)"
      aria-label={`Add ${p.name} to cart`}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
