"use client";

import { useEffect } from "react";

// Inside the dashboard: keeps the menu so the owner can go elsewhere
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">Nothing was lost. Please try again, or pick another page from the menu.</p>
      <button onClick={reset} className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover">Try again</button>
      {error.digest && <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>}
    </div>
  );
}
