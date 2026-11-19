import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, Circle, Clock, Copy, ExternalLink, Package, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, timeAgo } from "@/lib/orders";
import { formatCedis } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { storePathUrl, storeUrl } from "@/lib/tenant";
import { Alert } from "@/components/ui/alert";
import { StoreStatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata: Metadata = { title: "Overview" };

export default async function StoreOverviewPage({ params, searchParams }: PageProps<"/dashboard/[storeId]">) {
  const { storeId } = await params;
  const { welcome, password, joined } = await searchParams;
  const { user, store } = await requireStoreAccess(storeId);
  const supabase = await createClient();
  const isOwner = store.role === "owner";

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const canSeeSales = store.role !== "staff"; // money figures for owners and managers only
  const [{ data: salesData }, { data: countsData }, { data: recentOrders }] = await Promise.all([
    supabase.rpc("get_store_sales", { p_store_id: storeId }),
    supabase.rpc("get_order_counts", { p_store_id: storeId }),
    supabase.from("orders").select("id, order_number, customer_name, total, status, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(5),
  ]);
  const sales = (salesData ?? {}) as Record<string, number>;
  const orderCounts = (countsData ?? {}) as Record<string, number>;
  const newOrders = Number(orderCounts.pending ?? 0);
  const [products, settings, delivery, zones, payment, visible, outOfStock, categoryCount, recent] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("store_settings").select("whatsapp_number, logo_url, description").eq("store_id", storeId).maybeSingle(),
    supabase.from("store_delivery_settings").select("method, pickup_lat, delivery_enabled").eq("store_id", storeId).maybeSingle(),
    supabase.from("delivery_zones").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("is_active", true),
    isOwner
      ? supabase.from("store_payment_settings").select("cod_enabled, paystack_subaccount_code").eq("store_id", storeId).maybeSingle()
      : Promise.resolve({ data: null }),
    count(supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("is_active", true)),
    count(supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("stock_quantity", 0)),
    count(supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId)),
    supabase
      .from("products")
      .select("id, name, price, stock_quantity, is_active, product_images(image_url, sort_order)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "product_images" })
      .limit(1, { referencedTable: "product_images" })
      .limit(5),
  ]);

  const deliveryReady =
    !!delivery.data?.delivery_enabled &&
    (delivery.data.method === "zones" ? (zones.count ?? 0) > 0 : delivery.data.pickup_lat !== null);

  const checklist = [
    { done: (products.count ?? 0) > 0, label: "Add your first product", hint: "Photos, price and stock.", section: "products", show: true },
    { done: deliveryReady, label: "Set your delivery prices", hint: "By zone (area) or by distance.", section: "delivery", show: store.role !== "staff" },
    {
      done: !!settings.data?.whatsapp_number && !!settings.data?.logo_url,
      label: "Add your logo and WhatsApp number",
      hint: "So customers recognise you and can chat.",
      section: "settings",
      show: isOwner,
    },
    {
      done: !!payment.data && (payment.data.cod_enabled || !!payment.data.paystack_subaccount_code),
      label: "Choose how customers pay",
      hint: payment.data?.paystack_subaccount_code
        ? "Pay on delivery, MoMo and card are set up."
        : payment.data?.cod_enabled
          ? "Pay on delivery is on. Connect Paystack to accept MoMo and card."
          : "Pay on delivery, MoMo and card.",
      section: "payments",
      show: isOwner,
    },
  ].filter((i) => i.show);
  const doneCount = checklist.filter((i) => i.done).length;

  const firstName = user.fullName?.split(" ")[0];
  const url = storeUrl(store.slug);

  return (
    <div className="space-y-8">
      {welcome === "1" && (
        <Alert tone="success" title="Your store is created!">
          Set it up below while we review it. You&apos;ll be able to share your link as soon as it&apos;s approved.
        </Alert>
      )}
      {password === "updated" && <Alert tone="success">Your password has been changed.</Alert>}
      {joined === "1" && <Alert tone="success" title={`Welcome to ${store.name}!`}>You&apos;re now part of the team as {store.role}.</Alert>}

      <div>
        <p className="text-sm text-muted">{firstName ? `Akwaaba, ${firstName}` : "Akwaaba"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{store.name}</h1>
          <StoreStatusBadge status={store.status} />
        </div>
      </div>

      {/* Status */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        {store.status === "pending" && (
          <div className="flex gap-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Waiting for approval</h2>
              <p className="mt-1 text-sm text-muted">
                We review new stores to keep Akwaaba Shops safe for customers, usually within a day. Your store isn&apos;t
                visible to the public yet, but you can preview it and finish setting up.
              </p>
            </div>
          </div>
        )}
        {store.status === "suspended" && (
          <div className="flex gap-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Your store is suspended</h2>
              <p className="mt-1 text-sm text-muted">Customers can&apos;t see it right now. Please contact Akwaaba Shops support.</p>
              {store.statusReason && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">Reason: {store.statusReason}</p>}
            </div>
          </div>
        )}
        {store.status === "active" && (
          <div className="flex gap-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Your store is live</h2>
              <p className="mt-1 text-sm text-muted">Share your link on WhatsApp, Instagram and TikTok.</p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Your store link</p>
            <p className="truncate font-medium">{url.replace(/^https?:\/\//, "")}</p>
            <p className="mt-0.5 truncate text-xs text-muted">Backup link: {storePathUrl(store.slug).replace(/^https?:\/\//, "")}</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={url} label="Copy link" icon={<Copy className="h-4 w-4" aria-hidden="true" />} />
            {/* Pending stores: preview on the main domain, where you're logged in */}
            <a href={store.status === "active" ? url : storePathUrl(store.slug)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-paper">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {store.status === "active" ? "Open" : "Preview"}
            </a>
          </div>
        </div>
      </section>

      {newOrders > 0 && (
        <Link href={`/dashboard/${storeId}/orders`} className="flex items-center gap-4 rounded-2xl border border-gold/50 bg-gold-soft p-5 hover:border-gold">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-on-gold"><Bell className="h-5 w-5" aria-hidden="true" /></span>
          <span className="flex-1">
            <span className="block font-semibold">{newOrders} new {newOrders === 1 ? "order" : "orders"} waiting</span>
            <span className="block text-sm text-ink/70">Confirm quickly so customers know you&apos;re on it.</span>
          </span>
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}

      {/* Orders and sales */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Orders and sales">
        {[
          { label: "Orders today", value: String(sales.orders_today ?? 0), show: true },
          { label: "Sales today", value: formatCedis(Number(sales.sales_today ?? 0)), show: canSeeSales },
          { label: "Last 7 days", value: formatCedis(Number(sales.sales_7d ?? 0)), show: canSeeSales },
          { label: "Delivered (30 days)", value: formatCedis(Number(sales.delivered_30d ?? 0)), show: canSeeSales },
          { label: "In progress", value: String(Number(orderCounts.confirmed ?? 0) + Number(orderCounts.processing ?? 0) + Number(orderCounts.out_for_delivery ?? 0)), show: !canSeeSales },
        ].filter((x) => x.show).map((x) => (
          <Link key={x.label} href={`/dashboard/${storeId}/orders?tab=all`} className="rounded-xl border border-line bg-surface p-4 hover:border-brand/40">
            <p className="text-sm text-muted">{x.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{x.value}</p>
          </Link>
        ))}
      </section>
      {canSeeSales && <p className="-mt-5 text-xs text-muted">Sales include every order that isn&apos;t cancelled.</p>}

      {(recentOrders?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-semibold">Latest orders</h2>
            <Link href={`/dashboard/${storeId}/orders?tab=all`} className="text-sm font-medium text-brand hover:underline">All orders</Link>
          </div>
          <ul className="divide-y divide-line">
            {recentOrders!.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/${storeId}/orders/${r.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-paper">
                  <span className="w-14 font-semibold tabular-nums">#{r.order_number}</span>
                  <span className="min-w-0 flex-1 truncate">{r.customer_name}</span>
                  <span className="hidden text-sm text-muted sm:inline">{timeAgo(r.created_at)}</span>
                  <Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge>
                  <span className="w-24 text-right text-sm tabular-nums">{formatCedis(Number(r.total))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Store numbers">
        {[
          { label: "Products", value: products.count ?? 0, href: "products" },
          { label: "Visible in store", value: visible, href: "products?status=active" },
          { label: "Out of stock", value: outOfStock, href: "products?status=out", warn: outOfStock > 0 },
          { label: "Categories", value: categoryCount, href: store.role === "staff" ? null : "categories" },
        ].map((s) => {
          const body = (
            <>
              <p className="text-sm text-muted">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.warn ? "text-danger" : ""}`}>{s.value}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={`/dashboard/${storeId}/${s.href}`} className="rounded-xl border border-line bg-surface p-4 hover:border-brand/40">{body}</Link>
          ) : (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-4">{body}</div>
          );
        })}
      </section>

      {/* Setup checklist */}
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-semibold">Get your store ready</h2>
          <span className="text-sm text-muted">
            {doneCount} of {checklist.length} done
          </span>
        </div>
        <ul className="divide-y divide-line">
          {checklist.map((item) => (
            <li key={item.section}>
              <Link href={`/dashboard/${storeId}/${item.section}`} className="group flex items-center gap-4 px-6 py-4 hover:bg-paper">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-line-strong" aria-label="Not done" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={item.done ? "block text-muted line-through" : "block font-medium"}>{item.label}</span>
                  <span className="block text-sm text-muted">{item.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {(recent.data?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-semibold">Recently added</h2>
            <Link href={`/dashboard/${storeId}/products`} className="text-sm font-medium text-brand hover:underline">All products</Link>
          </div>
          <ul className="divide-y divide-line">
            {recent.data!.map((p) => {
              const img = p.product_images[0]?.image_url;
              return (
                <li key={p.id}>
                  <Link href={`/dashboard/${storeId}/products/${p.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-paper">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper text-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img ? <img src={thumbUrl(img)} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    {!p.is_active && <span className="text-xs text-muted">Hidden</span>}
                    <span className="text-sm tabular-nums">{formatCedis(Number(p.price))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
