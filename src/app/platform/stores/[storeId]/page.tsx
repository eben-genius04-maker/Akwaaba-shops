import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, StoreStatusBadge } from "@/components/ui/badge";
import { Stat } from "@/components/platform/stat";
import { PaystackBadge } from "@/components/platform/paystack-badge";
import { CommissionForm, StoreStatusActions } from "@/components/platform/store-admin-actions";
import { formatCedis, formatDateTime, formatGhanaPhone } from "@/lib/format";
import { STATUS_LABEL, timeAgo } from "@/lib/orders";
import { storeUrl } from "@/lib/tenant";

export const metadata: Metadata = { title: "Store" };

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export default async function PlatformStore({ params }: PageProps<"/platform/stores/[storeId]">) {
  const { storeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) notFound();
  const supabase = await createClient();
  const [{ data: store }, { data: summary }, { data: members }, { data: orders }, { data: log }, { data: pay }, { data: settings }] = await Promise.all([
    supabase.from("stores").select("id, name, slug, status, status_reason, created_at, approved_at").eq("id", storeId).maybeSingle(),
    supabase.rpc("admin_store_summary", { p_store_id: storeId }),
    supabase.from("store_members").select("role, created_at, profiles(full_name, email, phone)").eq("store_id", storeId).order("created_at"),
    supabase.from("orders").select("id, order_number, customer_name, total, status, payment_status, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(8),
    supabase.from("platform_audit_log").select("id, action, old_value, new_value, note, created_at, profiles(full_name, email)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(10),
    supabase.from("store_payment_settings").select("platform_fee_percent, paystack_mode, paystack_status, paystack_webhook_at, subaccount_connected_at, cod_enabled, prepaid_enabled").eq("store_id", storeId).maybeSingle(),
    supabase.from("store_settings").select("business_name, description, whatsapp_number, contact_phone, email, address, logo_url").eq("store_id", storeId).maybeSingle(),
  ]);
  if (!store) notFound();
  const sm = (summary ?? {}) as Record<string, number>;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/platform/stores" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Stores</Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-lg font-semibold text-brand">{store.name.slice(0, 1)}</span>
            )}
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">{store.name} <StoreStatusBadge status={store.status} /></h1>
              <p className="text-sm text-muted">
                Joined {formatDateTime(store.created_at)}{store.approved_at ? ` · approved ${formatDateTime(store.approved_at)}` : ""} ·{" "}
                <a href={storeUrl(store.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:underline">{store.slug} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
              </p>
            </div>
          </div>
          <StoreStatusActions storeId={store.id} storeName={store.name} status={store.status} />
        </div>
        {store.status === "suspended" && store.status_reason && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Suspended: {store.status_reason}</p>
        )}
        {store.status === "pending" && (
          <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm">Check the store&apos;s details and products, then approve it to make it visible to customers. You can open the storefront to preview it.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders (30 days)" value={sm.orders_30d ?? 0} hint={`${sm.orders_all ?? 0} all time · ${sm.cancelled_all ?? 0} cancelled`} />
        <Stat label="Order value" value={formatCedis(Number(sm.gmv_all ?? 0))} hint={`${formatCedis(Number(sm.gmv_30d ?? 0))} in 30 days`} />
        <Stat label="Paid online" value={formatCedis(Number(sm.online_paid ?? 0))} />
        <Stat label="Your commission" value={formatCedis(Number(sm.commission_all ?? 0))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Latest orders</h2>
            {!orders?.length ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-14 font-semibold tabular-nums">#{o.order_number}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customer_name}</span>
                    <span className="hidden text-muted sm:inline">{timeAgo(o.created_at)}</span>
                    {o.payment_status === "paid" && <Badge tone="success">Paid</Badge>}
                    <Badge tone={STATUS_LABEL[o.status].tone}>{STATUS_LABEL[o.status].label}</Badge>
                    <span className="w-24 text-right tabular-nums">{formatCedis(Number(o.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Admin history</h2>
            {!log?.length ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No admin changes yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {log.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <span className="font-medium">{l.action === "store_status" ? `Status: ${l.old_value} → ${l.new_value}` : `Commission: ${Number(l.old_value)}% → ${Number(l.new_value)}%`}</span>
                    {l.note && <span className="text-ink/80"> · {l.note}</span>}
                    <span className="block text-xs text-muted">{formatDateTime(l.created_at)} · {l.profiles?.full_name ?? l.profiles?.email ?? "System"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-semibold">Contact</h2>
            {settings?.description && <p className="text-muted">{settings.description}</p>}
            {settings?.whatsapp_number && <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><MessageCircle className="h-4 w-4 text-muted" aria-hidden="true" /> {formatGhanaPhone(settings.whatsapp_number)}</a>}
            {settings?.contact_phone && <a href={`tel:+${settings.contact_phone}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4 text-muted" aria-hidden="true" /> {formatGhanaPhone(settings.contact_phone)}</a>}
            {settings?.email && <a href={`mailto:${settings.email}`} className="flex items-center gap-2 hover:underline"><Mail className="h-4 w-4 text-muted" aria-hidden="true" /> {settings.email}</a>}
            {settings?.address && <p className="text-muted">{settings.address}</p>}
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-semibold">Team</h2>
            <ul className="space-y-2">
              {(members ?? []).map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.profiles?.full_name ?? m.profiles?.email}</span> <span className="text-muted">· {ROLE[m.role]}</span>
                  <span className="block text-xs text-muted">{m.profiles?.email}{m.profiles?.phone ? ` · ${formatGhanaPhone(m.profiles.phone)}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{sm.products_active ?? 0} of {sm.products ?? 0} products visible</p>
          </section>

          <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-semibold">Payments</h2>
            <p className="flex flex-wrap items-center gap-2">
              <PaystackBadge mode={pay?.paystack_mode ?? null} status={pay?.paystack_status ?? null} />
              {pay?.cod_enabled && <Badge>Pay on delivery</Badge>}
              {pay?.prepaid_enabled && <Badge tone="brand">Online on</Badge>}
            </p>
            {pay?.subaccount_connected_at && <p className="text-xs text-muted">Connected {formatDateTime(pay.subaccount_connected_at)} · {pay.paystack_webhook_at ? `last webhook ${timeAgo(pay.paystack_webhook_at)}` : "no webhook yet"}</p>}
            <CommissionForm storeId={store.id} percent={Number(pay?.platform_fee_percent ?? 1)} />
            <p className="text-xs text-muted">0–20%. Applies to new online payments; pay on delivery has no commission.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
