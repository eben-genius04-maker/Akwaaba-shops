"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export function CopyButton({ text, label, icon }: { text: string; label: string; icon?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link:", text);
        }
      }}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand hover:bg-brand-hover"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : icon}
      {copied ? "Copied" : label}
    </button>
  );
}
