"use client";

import { useEffect } from "react";
import Link from "next/link";
import { storeHref, useStore } from "@/components/storefront/store-context";

// Inside a store: keeps the store's header and brand colour
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { base } = useStore();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">Please try again. Your cart is still saved.</p>
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="inline-flex h-11 items-center rounded-full bg-(--store) px-6 font-medium text-(--store-ink)">Try again</button>
        <Link href={storeHref(base, "/")} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 font-medium">Shop home</Link>
      </div>
    </div>
  );
}
