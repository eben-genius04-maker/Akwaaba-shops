"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart";
import { storeHref, useStore } from "./store-context";

export function CartButton() {
  const { slug, base } = useStore();
  const { count } = useCart(slug);
  return (
    <Link
      href={storeHref(base, "/cart")}
      className="relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-ink/5"
      aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart, empty"}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-(--store) px-1 text-[11px] font-semibold text-(--store-ink) tabular-nums sm:static sm:h-5">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
