import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, back }: {
  title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({ title, description, children, className, footer }: {
  title?: string; description?: ReactNode; children: ReactNode; className?: string; footer?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface", className)}>
      {title && (
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      )}
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
      {footer && <div className="rounded-b-2xl border-t border-line bg-paper/60 px-5 py-4 sm:px-6">{footer}</div>}
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <p className="mt-4 font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
