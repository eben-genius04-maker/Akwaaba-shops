"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown if something breaks while loading a page (outside a store's pages)
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-sm font-medium text-brand">Akwaaba Shops</p>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-muted">Sorry about that. Please try again. If it keeps happening, check your internet connection.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover">Try again</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-paper">Home</Link>
      </div>
      {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
    </main>
  );
}
