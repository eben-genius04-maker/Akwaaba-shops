import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/platform/stat";
import { formatCedis, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Payments" };
const PAGE = 40;
const TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = { success: "success", failed: "danger", pending: "warning", abandoned: "neutral", refund_due: "danger" };
const LABEL: Record<string, string> = { success: "Paid", failed: "Failed", pending: "Waiting", abandoned: "Not finished", refund_due: "Refund due" };

export default async function PlatformPayments({ searchParams }: PageProps<"/platform/payments">) {
  const sp = await searchParams;
  const onlyPaid = sp.status !== "all";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select("id, reference, amount, platform_fee, status, channel, paid_at, created_at, store_id, stores(name), orders(order_number)", { count: "exact" });
  if (onlyPaid) query = query.in("status", ["success", "refund_due"]);
  const [{ data: rows, count }, { data: stats }] = await Promise.all([
    query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supabase.rpc("admin_platform_stats"),
  ]);
  const p = ((stats ?? {}) as { payments?: Record<string, number> }).payments ?? {};
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (c: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: onlyPaid ? null : "all", page: null, ...c })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/platform/payments?${s}` : "/platform/payments";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-muted">Online payments go into each store&apos;s own Paystack account. Your commission is split off automatically and paid out by Paystack to your account.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Commission, 30 days" value={formatCedis(Number(p.commission_30d ?? 0))} />
        <Stat label="Commission, all time" value={formatCedis(Number(p.commission_all ?? 0))} />
        <Stat label="Paid online, 30 days" value={formatCedis(Number(p.online_30d ?? 0))} />
        <Stat label="Payments, 30 days" value={Number(p.count_30d ?? 0)} />
      </div>
      <ul className="flex w-fit gap-1 rounded-xl bg-ink/5 p-1">
        {[{ k: null, l: "Paid" }, { k: "all", l: "All attempts" }].map((t) => (
          <li key={t.l}>
            <Link href={href({ status: t.k })} aria-current={(t.k === null) === onlyPaid ? "page" : undefined}
              className={cn("block rounded-lg px-3 py-1.5 text-sm font-medium", (t.k === null) === onlyPaid ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}>{t.l}</Link>
          </li>
        ))}
      </ul>
      {!rows?.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Store</th><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3 text-right font-medium">Commission</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-muted">{formatDateTime(r.paid_at ?? r.created_at)}</td>
                  <td className="px-4 py-3"><Link href={`/platform/stores/${r.store_id}`} className="font-medium hover:underline">{r.stores?.name}</Link></td>
                  <td className="px-4 py-3 tabular-nums">#{r.orders?.order_number}<span className="block font-mono text-xs text-muted">{r.reference}</span></td>
                  <td className="px-4 py-3 text-muted">{r.channel === "mobile_money" ? "MoMo" : r.channel === "card" ? "Card" : r.channel ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[r.status] ?? "neutral"}>{LABEL[r.status] ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCedis(Number(r.amount))}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{r.status === "success" ? formatCedis(Number(r.platform_fee)) : "—"}</td>
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
