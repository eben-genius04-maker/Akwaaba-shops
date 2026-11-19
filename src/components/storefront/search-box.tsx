"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { storeHref, useStore } from "./store-context";

export function SearchBox({ className }: { className?: string }) {
  const { base } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function go(value: string) {
    const v = value.trim();
    router.push(v ? `${storeHref(base, "/")}?q=${encodeURIComponent(v)}#products` : `${storeHref(base, "/")}#products`);
  }

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          placeholder="Search products"
          aria-label="Search products"
          className="h-10 w-full rounded-full border border-line-strong bg-surface pl-9 pr-9 text-[15px] placeholder:text-muted/70 focus:border-(--store) focus:outline-none focus:ring-2 focus:ring-(--store)/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); go(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
