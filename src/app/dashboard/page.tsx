import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { getMyStores, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PlainShell } from "@/components/dashboard/plain-shell";
import { StoreStatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Your stores" };

// Sends people to the right place: create a store, their only store, or a chooser.
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const stores = await getMyStores(user.id);
  const { password } = await searchParams;
  const suffix = password === "updated" ? "?password=updated" : "";

  if (stores.length === 0) {
    // Platform admins without a store of their own go to the admin panel
    if (user.isPlatformAdmin) redirect("/platform");
    // Shoppers (people with orders but no store) go to their account, not "create a store"
    const supabase = await createClient();
    const { data: orders } = await supabase.rpc("list_my_orders");
    redirect(orders?.length ? "/account" : "/dashboard/new");
  }
  // App shortcut "Orders" (long-press the installed icon)
  const { go } = await searchParams;
  if (stores.length === 1) redirect(`/dashboard/${stores[0].id}${go === "orders" ? "/orders" : suffix}`);

  return (
    <PlainShell email={user.email}>
      <h1 className="text-2xl font-semibold tracking-tight">Your stores</h1>
      <p className="mt-1 text-muted">Choose a store to manage.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {stores.map((s) => (
          <li key={s.id}>
            <Link href={`/dashboard/${s.id}`} className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 hover:border-brand/40 hover:shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold-soft font-semibold text-warning">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="mt-1 flex items-center gap-2 text-xs capitalize text-muted">
                  {s.role} · <StoreStatusBadge status={s.status} />
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <Link href="/dashboard/new" className="flex h-full min-h-[88px] items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-5 text-sm font-medium text-brand hover:bg-surface">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create another store
          </Link>
        </li>
      </ul>
    </PlainShell>
  );
}
