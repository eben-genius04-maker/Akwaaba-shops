import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCedis } from "@/lib/format";
import { timeAgo } from "@/lib/orders";
import { Stat } from "@/components/platform/stat";

export const metadata: Metadata = { title: "Overview" };

type Stats = {
  stores: { pending: number; active: number; suspended: number; all: number; new_7d: number };
  orders: { today: number; last_7d: number; last_30d: number; gmv_30d: number; gmv_all: number };
  payments: { online_30d: number; commission_30d: number; commission_all: number; count_30d: number };
  paystack: { live: number; test: number; broken: number };
  customers: number;
};

export default async function PlatformOverview() {
  const supabase = await createClient();
  const [{ data }, { data: pending }] = await Promise.all([
    supabase.rpc("admin_platform_stats"),
    supabase.rpc("admin_list_stores", { p_status: "pending", p_limit: 5 }),
  ]);
  const s = data as unknown as Stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-muted">Everything happening across Akwaaba Shops.</p>
      </div>

      {s.stores.pending > 0 && (
        <section className="rounded-2xl border border-gold/50 bg-gold-soft">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 className="font-semibold">{s.stores.pending} {s.stores.pending === 1 ? "store is" : "stores are"} waiting for approval</h2>
            <Link href="/platform/stores?status=pending" className="text-sm font-medium hover:underline">See all</Link>
          </div>
          <ul className="divide-y divide-gold/30 border-t border-gold/30">
            {(pending ?? []).map((st) => (
              <li key={st.id}>
                <Link href={`/platform/stores/${st.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gold/10">
                  <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{st.name}</span>
                    <span className="block truncate text-sm text-ink/70">{st.owner_email} · {Number(st.product_count)} products · signed up {timeAgo(st.created_at)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="money-h">
        <h2 id="money-h" className="mb-3 font-semibold">Money (last 30 days)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Your commission" value={formatCedis(Number(s.payments.commission_30d))} hint={`${formatCedis(Number(s.payments.commission_all))} all time`} href="/platform/payments" />
          <Stat label="Paid online" value={formatCedis(Number(s.payments.online_30d))} hint={`${s.payments.count_30d} payments`} href="/platform/payments" />
          <Stat label="Order value" value={formatCedis(Number(s.orders.gmv_30d))} hint="All orders not cancelled" />
          <Stat label="Order value, all time" value={formatCedis(Number(s.orders.gmv_all))} />
        </div>
      </section>

      <section aria-labelledby="activity-h">
        <h2 id="activity-h" className="mb-3 font-semibold">Activity</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Orders today" value={s.orders.today} hint={`${s.orders.last_7d} in 7 days · ${s.orders.last_30d} in 30`} href="/platform/orders" />
          <Stat label="Live stores" value={s.stores.active} hint={`${s.stores.new_7d} new this week`} href="/platform/stores?status=active" />
          <Stat label="Waiting for approval" value={s.stores.pending} href="/platform/stores?status=pending" tone={s.stores.pending ? "warning" : undefined} />
          <Stat label="Suspended" value={s.stores.suspended} href="/platform/stores?status=suspended" />
          <Stat label="Paystack live" value={s.paystack.live} hint={`${s.paystack.test} in test mode`} />
          <Stat label="Paystack paused" value={s.paystack.broken} hint="Commission split changed" tone={s.paystack.broken ? "danger" : undefined} />
          <Stat label="Customer accounts" value={s.customers} hint="People without a store" />
          <Stat label="All stores" value={s.stores.all} href="/platform/stores?status=all" />
        </div>
      </section>
    </div>
  );
}
