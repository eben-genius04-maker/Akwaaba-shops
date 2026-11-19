"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/stores", label: "Stores" },
  { href: "/platform/orders", label: "Orders" },
  { href: "/platform/payments", label: "Payments" },
  { href: "/platform/activity", label: "Activity" },
  { href: "/platform/setup", label: "Go-live checks" },
];

export function PlatformNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1">
        {ITEMS.map((i) => {
          const active = i.href === "/platform" ? path === "/platform" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium", active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {i.label}
                {i.href === "/platform/stores" && pending > 0 && (
                  <span className="rounded-full bg-gold px-1.5 text-xs font-semibold text-on-gold" aria-label={`${pending} waiting for approval`}>{pending}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
