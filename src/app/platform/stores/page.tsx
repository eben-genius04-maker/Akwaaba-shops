import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StoreStatusBadge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/field";
import { PaystackBadge } from "@/components/platform/paystack-badge";
import { timeAgo } from "@/lib/orders";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Stores" };
const PAGE = 30;
const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "active", label: "Live" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
] as const;

export default async function PlatformStores({ searchParams }: PageProps<"/platform/stores">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const tab = (TABS.find((t) => t.key === sp.status)?.key ?? (q ? "all" : "all")) as (typeof TABS)[number]["key"];
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  const supabase = await createClient();
  const { data: stores } = await supabase.rpc("admin_list_stores", {
    p_status: tab === "all" ? undefined : tab,
    p_search: q || undefined,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const total = Number(stores?.[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (c: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: tab === "all" ? null : tab, q: q || null, page: null, ...c })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/platform/stores?${s}` : "/platform/stores";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex gap-1 rounded-xl bg-ink/5 p-1">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link href={href({ status: t.key === "all" ? null : t.key })} aria-current={tab === t.key ? "page" : undefined}
                className={cn("block rounded-lg px-3 py-1.5 text-sm font-medium", tab === t.key ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
        <form action="/platform/stores" className="relative sm:w-80" role="search">
          {tab !== "all" && <input type="hidden" name="status" value={tab} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Store name, address or owner email" aria-label="Search stores" className={cn(inputClass, "h-10 pl-9")} />
        </form>
      </div>

      {!stores?.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted">No stores here.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Orders (30 d)</th>
                <th className="px-4 py-3 font-medium">Payments</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/platform/stores/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    <span className="block text-xs text-muted">{s.slug} · joined {timeAgo(s.created_at)}</span>
                  </td>
                  <td className="px-4 py-3"><span className="block">{s.owner_name ?? "—"}</span><span className="text-xs text-muted">{s.owner_email}</span></td>
                  <td className="px-4 py-3 tabular-nums">{Number(s.product_count)}</td>
                  <td className="px-4 py-3 tabular-nums">{Number(s.orders_30d)} <span className="text-xs text-muted">/ {Number(s.order_count)} all</span></td>
                  <td className="px-4 py-3"><PaystackBadge mode={s.paystack_mode} status={s.paystack_status} /> <span className="text-xs text-muted">{Number(s.platform_fee_percent)}%</span></td>
                  <td className="px-4 py-3"><StoreStatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="inline-flex items-center gap-1 font-medium"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages} · {total} stores</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="inline-flex items-center gap-1 font-medium">Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link> : <span />}
        </nav>
      )}
    </div>
  );
}
