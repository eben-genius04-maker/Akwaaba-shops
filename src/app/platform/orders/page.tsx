import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/field";
import { formatCedis, formatGhanaPhone, normalizeGhanaPhone } from "@/lib/format";
import { STATUS_LABEL, timeAgo, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Orders" };
const PAGE = 40;
const FILTERS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "new", label: "New", statuses: ["pending"] },
  { key: "active", label: "In progress", statuses: ["confirmed", "processing", "out_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

// Read-only view of orders across every store (for support questions)
export default async function PlatformOrders({ searchParams }: PageProps<"/platform/orders">) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, total, status, payment_method, payment_status, created_at, store_id, stores(name)", { count: "exact" });
  if (filter.statuses.length) query = query.in("status", filter.statuses);
  if (q) {
    const phone = normalizeGhanaPhone(q);
    if (phone) query = query.eq("customer_phone", phone);
    else if (/^#?\d{1,7}$/.test(q)) query = query.eq("order_number", Number(q.replace("#", "")));
    else query = query.ilike("customer_name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const { data: orders, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (c: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: filter.key === "all" ? null : filter.key, q: q || null, page: null, ...c })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/platform/orders?${s}` : "/platform/orders";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted">Every order on the platform. Stores manage their own orders; this view is for support.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link href={href({ status: f.key === "all" ? null : f.key })} aria-current={filter.key === f.key ? "page" : undefined}
                className={cn("block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium", filter.key === f.key ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}>{f.label}</Link>
            </li>
          ))}
        </ul>
        <form action="/platform/orders" className="relative sm:w-72" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Customer phone, name or #" aria-label="Search orders" className={cn(inputClass, "h-10 pl-9")} />
        </form>
      </div>
      {!orders?.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted">No orders found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-4 py-3 font-medium">Store</th><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Payment</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3"><Link href={`/platform/stores/${o.store_id}`} className="font-medium hover:underline">{o.stores?.name}</Link></td>
                  <td className="px-4 py-3 tabular-nums">#{o.order_number}</td>
                  <td className="px-4 py-3">{o.customer_name}<span className="block text-xs text-muted">{formatGhanaPhone(o.customer_phone)}</span></td>
                  <td className="px-4 py-3 text-muted">{timeAgo(o.created_at)}</td>
                  <td className="px-4 py-3">{o.payment_status === "paid" ? <Badge tone="success">Paid</Badge> : <span className="text-muted">{o.payment_method === "prepaid" ? "Online, unpaid" : "On delivery"}</span>}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_LABEL[o.status].tone}>{STATUS_LABEL[o.status].label}</Badge></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCedis(Number(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="inline-flex items-center gap-1 font-medium"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="inline-flex items-center gap-1 font-medium">Older <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link> : <span />}
        </nav>
      )}
    </div>
  );
}
