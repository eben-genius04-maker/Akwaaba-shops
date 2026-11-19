import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink/80",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StoreStatusBadge({ status }: { status: "pending" | "active" | "suspended" }) {
  const map = {
    pending: { tone: "warning" as const, label: "Pending approval" },
    active: { tone: "success" as const, label: "Live" },
    suspended: { tone: "danger" as const, label: "Suspended" },
  };
  const { tone, label } = map[status];
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
