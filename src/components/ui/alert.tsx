import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";
const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-brand-soft text-brand border-brand/20", Icon: Info },
  success: { box: "bg-success-soft text-success border-success/20", Icon: CheckCircle2 },
  warning: { box: "bg-warning-soft text-warning border-gold/40", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger border-danger/20", Icon: AlertCircle },
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink/80">{children}</div>}
      </div>
    </div>
  );
}
