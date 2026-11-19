"use client";

import Link from "next/link";
import { storeHref, useStore } from "@/components/storefront/store-context";

// Shown inside the store when a product or page doesn't exist
export default function StorePageNotFound() {
  const { base } = useStore();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="mt-2 text-muted">This product may have sold out or been removed.</p>
      <Link href={storeHref(base, "/")} className="mt-6 inline-flex h-11 items-center rounded-full bg-(--store) px-6 font-medium text-(--store-ink)">
        Back to the shop
      </Link>
    </div>
  );
}
