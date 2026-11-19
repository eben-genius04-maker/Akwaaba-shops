import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4";
  return href ? <Link href={href} className={cn(cls, "hover:border-brand/40")}>{body}</Link> : <div className={cls}>{body}</div>;
}
