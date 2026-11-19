import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/field";
import { AlertsToggle } from "@/components/orders/alerts-toggle";
import { formatCedis, formatGhanaPhone, normalizeGhanaPhone } from "@/lib/format";
import { ORDER_TABS, STATUS_LABEL, timeAgo, type OrderTab } from "@/lib/orders";
import { likePattern } from "@/lib/storefront";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Orders" };
const PAGE_SIZE = 30;

export default async function OrdersPage({ params, searchParams }: PageProps<"/dashboard/[storeId]/orders">) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(storeId);
  const supabase = await createClient();

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const tab: OrderTab = typeof sp.tab === "string" && sp.tab in ORDER_TABS ? (sp.tab as OrderTab) : q ? "all" : "new";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, total, status, payment_method, payment_status, created_at, delivery_zone_name, area, delivery_distance_km, order_items(quantity)", { count: "exact" })
    .eq("store_id", store.id);
  const statuses = ORDER_TABS[tab].statuses;
  if (statuses.length) query = query.in("status", statuses);
  if (q) {
    const num = /^#?(\d{1,7})$/.exec(q);
    const phone = normalizeGhanaPhone(q);
    if (num && Number(num[1]) < 1000000 && !phone) query = query.eq("order_number", Number(num[1]));
    else if (phone) query = query.eq("customer_phone", phone);
    else query = query.ilike("customer_name", likePattern(q));
  }
  const [{ data: orders, count }, { data: counts }] = await Promise.all([
    query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.rpc("get_order_counts", { p_store_id: store.id }),
  ]);
  const c = (counts ?? {}) as Record<string, number>;
  const tabCount: Record<OrderTab, number> = {
    new: c.pending ?? 0,
    active: (c.confirmed ?? 0) + (c.processing ?? 0) + (c.out_for_delivery ?? 0),
    delivered: c.delivered ?? 0,
    cancelled: c.cancelled ?? 0,
    all: c.all ?? 0,
  };
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/dashboard/${store.id}/orders`;
  const href = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { tab: tab === "new" && !q ? null : tab, q: q || null, page: null, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader title="Orders" description="Confirm new orders quickly: customers see every update on their tracking page." actions={<AlertsToggle />} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Order status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-1 rounded-xl bg-ink/5 p-1">
            {(Object.keys(ORDER_TABS) as OrderTab[]).map((t) => (
              <li key={t}>
                <Link
                  href={href({ tab: t === "new" ? null : t, q: null })}
                  aria-current={tab === t && !q ? "page" : undefined}
                  className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium", tab === t && !q ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}
                >
                  {ORDER_TABS[t].label}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", t === "new" && tabCount.new > 0 ? "bg-gold text-on-gold" : "text-muted")}>{tabCount[t]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={base} className="relative sm:w-72" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Order #, name or phone" aria-label="Search orders" className={cn(inputClass, "h-10 pl-9")} />
        </form>
      </div>

      {q && (
        <p className="mt-4 text-sm text-muted">
          {total} {total === 1 ? "result" : "results"} for &ldquo;{q}&rdquo; · <Link href={base} className="font-medium text-ink underline">Clear</Link>
        </p>
      )}

      {!orders?.length ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <Inbox className="h-7 w-7 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{q ? "No matching orders" : tab === "new" ? "No new orders" : "Nothing here yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {tab === "new" && !q ? "New orders appear here, and you'll get a sound and a pop-up while this dashboard is open." : "Try another tab or search."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {orders.map((o) => {
            const st = STATUS_LABEL[o.status];
            const items = o.order_items.reduce((n, i) => n + i.quantity, 0);
            const where = o.delivery_zone_name ?? (o.delivery_distance_km !== null ? `${Number(o.delivery_distance_km)} km` : null) ?? o.area;
            return (
              <li key={o.id}>
                <Link href={`${base}/${o.id}`} className={cn("flex items-center gap-3 px-4 py-3.5 hover:bg-paper sm:gap-4 sm:px-5", o.status === "pending" && "bg-gold-soft/40")}>
                  <span className="w-14 shrink-0 font-semibold tabular-nums">#{o.order_number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.customer_name}</span>
                    <span className="block truncate text-sm text-muted">
                      {formatGhanaPhone(o.customer_phone)} · {items} {items === 1 ? "item" : "items"}{where ? ` · ${where}` : ""}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm text-muted sm:block">{timeAgo(o.created_at)}</span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{formatCedis(Number(o.total))}</span>
                    <span className="flex gap-1">
                      {o.payment_status === "paid" && <Badge tone="success">Paid</Badge>}
                      {o.payment_method === "prepaid" && o.payment_status !== "paid" && o.status === "pending" && <Badge>Awaiting payment</Badge>}
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-2 font-medium hover:bg-paper"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Newer</Link>
          ) : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-2 font-medium hover:bg-paper">Older <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
          ) : <span />}
        </nav>
      )}
    </>
  );
}
