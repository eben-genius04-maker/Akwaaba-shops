import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, ShoppingBag, Star, Store, Trash2 } from "lucide-react";
import { getMyStores, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { storeUrl } from "@/lib/tenant";
import { formatCedis, formatDateTime } from "@/lib/format";
import { PlainShell } from "@/components/dashboard/plain-shell";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { deleteAddress, makeDefaultAddress } from "@/actions/account";

export const metadata: Metadata = { title: "My account" };

const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  pending: { label: "Waiting for store", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "brand" },
  processing: { label: "Being prepared", tone: "brand" },
  out_for_delivery: { label: "On the way", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

// One account for every Akwaaba Shops store: orders from all shops, saved addresses.
export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: orders }, { data: addresses }, stores] = await Promise.all([
    supabase.rpc("list_my_orders"),
    supabase.from("customer_addresses").select("id, label, digital_address, landmark, area, city, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    getMyStores(user.id),
  ]);

  return (
    <PlainShell email={user.email} logoHref="/account">
      <h1 className="text-2xl font-semibold tracking-tight">{user.fullName ? `Hi, ${user.fullName.split(" ")[0]}` : "My account"}</h1>
      <p className="mt-1 text-muted">Your orders and saved addresses, for every shop on Akwaaba Shops.</p>

      <section className="mt-8" aria-labelledby="orders-title">
        <h2 id="orders-title" className="font-semibold">My orders</h2>
        {!orders?.length ? (
          <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
            <ShoppingBag className="h-6 w-6 text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted">Orders you place while logged in show up here.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {orders.map((o) => {
              const st = STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
              return (
                <li key={o.tracking_token}>
                  <a href={`${storeUrl(o.store_slug)}/order/${o.tracking_token}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.store_name} · #{o.order_number}</span>
                      <span className="block text-sm text-muted">{formatDateTime(o.created_at)} · {o.item_count} {Number(o.item_count) === 1 ? "item" : "items"}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{formatCedis(Number(o.total))}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="addresses-title">
        <h2 id="addresses-title" className="font-semibold">Saved addresses</h2>
        {!addresses?.length ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-8 text-center text-sm text-muted">
            Tick &ldquo;Save this address&rdquo; at checkout and it will appear here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
                <p className="flex items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4 text-muted" aria-hidden="true" /> {a.label}
                  {a.is_default && <Badge tone="brand">Default</Badge>}
                </p>
                <p className="mt-1 text-sm text-muted">{[a.digital_address, a.landmark, a.area, a.city].filter(Boolean).join(", ")}</p>
                <div className="mt-auto flex gap-2 pt-3">
                  {!a.is_default && (
                    <ActionForm action={makeDefaultAddress} hidden={{ addressId: a.id }}>
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-ink/5"><Star className="h-4 w-4" aria-hidden="true" /> Make default</button>
                    </ActionForm>
                  )}
                  <ActionForm action={deleteAddress} hidden={{ addressId: a.id }} confirm={{ title: `Delete "${a.label}"?`, confirmLabel: "Delete", danger: true }}>
                    <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:text-danger" aria-label={`Delete ${a.label}`}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.isPlatformAdmin && (
        <Link href="/platform" className="mt-8 flex items-center justify-between rounded-2xl border border-line bg-surface p-5 hover:border-brand/40">
          <span><span className="block font-semibold">Platform admin</span><span className="text-sm text-muted">Approve stores, set commission, see payments.</span></span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4" aria-hidden="true" /> {stores.length ? "Your stores" : "Sell on Akwaaba Shops"}</p>
        <p className="mt-1 text-sm text-muted">{stores.length ? "Manage products, delivery and orders." : "Open your own online shop in minutes. It's free to start."}</p>
        <Link href={stores.length ? "/dashboard" : "/dashboard/new"} className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">
          {stores.length ? "Go to dashboard" : "Open a shop"} →
        </Link>
      </section>
    </PlainShell>
  );
}
