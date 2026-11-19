"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-paper print:hidden">
      <Printer className="h-4 w-4" aria-hidden="true" /> Print
    </button>
  );
}
