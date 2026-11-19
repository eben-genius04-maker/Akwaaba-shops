"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { InstallButton } from "@/components/pwa/install-button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown, ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, Package, Plus, Settings,
  ShieldCheck, ShoppingBag, Truck, Users, Wallet, X, Check,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { StoreStatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { signOut } from "@/actions/auth";
import type { NavItem } from "./nav";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "": LayoutDashboard, orders: ShoppingBag, products: Package, categories: FolderTree,
  delivery: Truck, payments: Wallet, staff: Users, settings: Settings,
};

type StoreLite = { id: string; name: string; slug: string; status: "pending" | "active" | "suspended"; role: string };

export function Sidebar({
  store, stores, items, storefrontUrl, user, pendingOrders = 0, isPlatformAdmin = false,
}: {
  store: StoreLite;
  stores: StoreLite[];
  items: NavItem[];
  storefrontUrl: string;
  user: { name: string; email: string };
  pendingOrders?: number;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Updated live by <OrderPulse> when new orders arrive
  const [pending, setPending] = useState(pendingOrders);
  const [prevProp, setPrevProp] = useState(pendingOrders);
  if (pendingOrders !== prevProp) {
    // Fresh count from the server (e.g. after confirming an order)
    setPrevProp(pendingOrders);
    setPending(pendingOrders);
  }
  useEffect(() => {
    const on = (e: Event) => setPending((e as CustomEvent<number>).detail);
    window.addEventListener("akwaaba:pending-orders", on);
    return () => window.removeEventListener("akwaaba:pending-orders", on);
  }, []);
  const base = `/dashboard/${store.id}`;

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo href="/dashboard" />
        <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <StoreSwitcher store={store} stores={stores} />

      <nav className="mt-4 flex-1 space-y-0.5 px-3" aria-label="Store">
        {items.map((item) => {
          const href = item.section ? `${base}/${item.section}` : base;
          const active = item.section ? pathname.startsWith(href) : pathname === base;
          const Icon = ICONS[item.section] ?? LayoutDashboard;
          return (
            <Link
              key={item.section}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand text-on-brand" : "text-ink/80 hover:bg-ink/5 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.section === "orders" && pending > 0 && (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", active ? "bg-surface text-brand" : "bg-gold text-on-gold")} aria-label={`${pending} new`}>
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View your store
        </a>
        <InstallButton className="w-full rounded-lg px-3 py-2 text-ink/80 hover:bg-ink/5" />
        {isPlatformAdmin && (
          <Link href="/platform" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Platform admin
          </Link>
        )}
        <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <ThemeToggle className="px-1.5" />
          <form action={signOut}>
            <button type="submit" className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <button onClick={() => setOpen(true)} className="relative rounded-md p-1.5 hover:bg-ink/5" aria-label={pending > 0 ? `Open menu, ${pending} new orders` : "Open menu"} aria-expanded={open}>
          <Menu className="h-5 w-5" />
          {pending > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-surface" aria-hidden="true" />}
        </button>
        <span className="truncate px-3 text-sm font-semibold">{store.name}</span>
        <StoreStatusBadge status={store.status} />
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface lg:block print:hidden">{nav}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
}

function StoreSwitcher({ store, stores }: { store: StoreLite; stores: StoreLite[] }) {
  return (
    <details className="group relative mx-3">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-paper [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-sm font-semibold text-warning">
          {store.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{store.name}</span>
          <span className="block truncate text-xs capitalize text-muted">{store.role}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-line bg-surface p-1 shadow-lg">
        {stores.map((s) => (
          <Link key={s.id} href={`/dashboard/${s.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-paper">
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {s.id === store.id && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
          </Link>
        ))}
        <Link href="/dashboard/new" className="mt-1 flex items-center gap-2 rounded-md border-t border-line px-2.5 py-2 text-sm font-medium text-brand hover:bg-paper">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create another store
        </Link>
      </div>
    </details>
  );
}
