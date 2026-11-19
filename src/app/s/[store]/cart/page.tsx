import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your cart</h1>
      <CartView />
    </div>
  );
}
