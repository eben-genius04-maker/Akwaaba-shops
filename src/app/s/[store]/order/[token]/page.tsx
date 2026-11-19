import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Bike, Check, CheckCircle2, Clock, Copy, MapPin, MessageCircle, Package, Phone, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getStoreBase, getStoreOrigin } from "@/lib/storefront";
import { formatCedis, formatDateTime, formatGhanaPhone } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";
import { CopyButton } from "@/components/ui/copy-button";
import { ActionForm } from "@/components/ui/action-form";
import { cancelOrder, payForOrder } from "@/actions/checkout";
import { expireUnpaidOrders, verifyAndRecord } from "@/lib/payments";
import { serverEnv } from "@/lib/server-env";
import { PayNowButton } from "@/components/storefront/pay-now";
import { OrderAutoRefresh } from "@/components/storefront/order-live";
import { whatsappLink } from "@/components/storefront/whatsapp";

type Status = "pending" | "confirmed" | "processing" | "out_for_delivery" | "delivered" | "cancelled";
type Order = {
  order_number: number; status: Status; payment_method: "pay_on_delivery" | "prepaid"; payment_status: string;
  subtotal: number; delivery_fee: number; delivery_fee_adjusted: boolean; total: number; currency: string;
  customer_name: string; customer_phone: string; digital_address: string | null; landmark: string | null;
  area: string | null; city: string | null; delivery_zone_name: string | null; delivery_distance_km: number | null;
  notes: string | null; cancel_reason: string | null; created_at: string; expires_at: string | null;
  store: { name: string; slug: string; logo_url: string | null; whatsapp_number: string | null; contact_phone: string | null };
  items: { product_id: string | null; name: string; image_url: string | null; unit_price: number; quantity: number; subtotal: number }[];
  timeline: { status: Status; note: string | null; at: string }[];
};

const STEPS: { status: Status; label: string; icon: typeof Check }[] = [
  { status: "pending", label: "Order placed", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: Check },
  { status: "processing", label: "Being prepared", icon: Package },
  { status: "out_for_delivery", label: "On the way", icon: Bike },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const HEADLINE: Record<Status, string> = {
  pending: "Waiting for the store to confirm",
  confirmed: "The store confirmed your order",
  processing: "Your order is being prepared",
  out_for_delivery: "Your order is on the way",
  delivered: "Delivered. Enjoy!",
  cancelled: "This order was cancelled",
};

async function getOrderFresh(token: string): Promise<Order | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  // The tracking link is the key, so this never depends on the visitor's login
  // (customers come back from Paystack possibly signed out or with an old session).
  const { data, error } = await createPublicClient().rpc("get_order_by_token", { p_token: token });
  if (error) console.error("get_order_by_token:", error.message);
  return (data as Order | null) ?? null;
}
const getOrder = cache(getOrderFresh);

export async function generateMetadata({ params }: PageProps<"/s/[store]/order/[token]">): Promise<Metadata> {
  const { token } = await params;
  const order = await getOrder(token);
  return { title: order ? `Order #${order.order_number}` : "Order not found", robots: { index: false, follow: false } };
}

export default async function OrderPage({ params, searchParams }: PageProps<"/s/[store]/order/[token]">) {
  const { store: slug, token } = await params;
  const { new: isNew, reference } = await searchParams;
  let order = await getOrder(token);

  // Online payment: coming back from Paystack, or an unpaid order. Ask Paystack for the
  // real result (never trust the address bar), and cancel orders not paid in time.
  let payResult: string | null = null;
  if (order?.payment_method === "prepaid" && order.payment_status !== "paid" && serverEnv.paymentsConfigured()) {
    if (typeof reference === "string" && reference) payResult = await verifyAndRecord(reference);
    if (order.status === "pending") await expireUnpaidOrders();
    order = await getOrderFresh(token);
  }
  // Back from Paystack but the webhook already confirmed it: still say thanks
  if (!payResult && typeof reference === "string" && reference && order?.payment_method === "prepaid" && order.payment_status === "paid") {
    payResult = "paid";
  }
  if (!order || order.store.slug !== slug.toLowerCase()) notFound();
  const [base, origin] = await Promise.all([getStoreBase(order.store.slug), getStoreOrigin()]);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims?.sub;

  const pageUrl = `${origin}${base}/order/${token}`;
  const cancelled = order.status === "cancelled";
  const finished = cancelled || order.status === "delivered";
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const canCancel = order.status === "pending" && ["unpaid", "failed"].includes(order.payment_status);
  const paid = order.payment_status === "paid";
  const awaitingPayment = order.payment_method === "prepaid" && !paid && order.status === "pending";
  const wa = order.store.whatsapp_number;
  const firstName = order.customer_name.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:pt-10">
      <OrderAutoRefresh active={!finished} />

      {awaitingPayment && (
        <div className="mb-6 space-y-3 rounded-2xl border border-gold/50 bg-gold-soft p-5">
          {payResult === "failed" && <p className="font-semibold text-danger" role="alert">Your payment didn&apos;t go through. Please try again.</p>}
          {payResult === "pending" && <p className="font-semibold">We&apos;re still waiting for Paystack to confirm your payment. This page updates by itself.</p>}
          <p className="text-sm">
            Pay <strong>{formatCedis(Number(order.total))}</strong> with MoMo or card to send your order to {order.store.name}.
            {order.expires_at && <> Pay before <strong>{formatDateTime(order.expires_at)}</strong>, or the order is cancelled automatically.</>}
          </p>
          <PayNowButton action={payForOrder} token={token} storeSlug={order.store.slug} />
        </div>
      )}
      {paid && payResult === "paid" && (
        <div className="mb-6 rounded-2xl bg-(--store) p-5 text-(--store-ink)">
          <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Payment received. Thank you, {firstName}!</p>
          <p className="mt-1 text-sm opacity-90">{order.store.name} has your order. Keep this page: it updates as your order moves.</p>
        </div>
      )}

      {isNew === "1" && !cancelled && !awaitingPayment && payResult !== "paid" && (
        <div className="mb-6 rounded-2xl bg-(--store) p-5 text-(--store-ink)">
          <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Thank you, {firstName}!</p>
          <p className="mt-1 text-sm opacity-90">Your order has been sent to {order.store.name}. Keep this page: it updates as your order moves.</p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Order #{order.order_number} · {formatDateTime(order.created_at)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{awaitingPayment ? "Waiting for your payment" : HEADLINE[order.status]}</h1>
        </div>
        <CopyButton text={pageUrl} label="Copy tracking link" icon={<Copy className="h-4 w-4" aria-hidden="true" />} />
      </div>

      {/* Progress */}
      {cancelled ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-5 text-sm">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="font-semibold text-danger">Cancelled</p>
            {order.cancel_reason && <p className="mt-1 text-ink/80">{order.cancel_reason}</p>}
          </div>
        </div>
      ) : (
        <ol className="mt-6 grid grid-cols-5 gap-1 rounded-2xl border border-line bg-surface p-4" aria-label="Order progress">
          {STEPS.map((s, i) => {
            const done = i <= stepIndex;
            return (
              <li key={s.status} className="flex flex-col items-center text-center" aria-current={i === stepIndex ? "step" : undefined}>
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", done ? "bg-(--store) text-(--store-ink)" : "bg-paper text-muted")}>
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={cn("mt-2 text-[11px] leading-tight sm:text-xs", done ? "font-medium" : "text-muted")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Contact the store */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {wa && (
          <a href={whatsappLink(wa, `Hello ${order.store.name}, I'm asking about my order #${order.order_number}.\n${pageUrl}`)} target="_blank" rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#177a43] px-5 text-sm font-medium text-white hover:bg-[#11612f]">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp the store
          </a>
        )}
        {order.store.contact_phone && (
          <a href={`tel:+${order.store.contact_phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-sm font-medium hover:bg-paper">
            <Phone className="h-4 w-4" aria-hidden="true" /> Call {formatGhanaPhone(order.store.contact_phone)}
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Items + money */}
        <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="items-title">
          <h2 id="items-title" className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((it, i) => (
              <li key={`${it.product_id}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-paper">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(it.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="m-3 h-5 w-5 text-muted" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2">{it.name}</span><span className="text-muted">× {it.quantity}</span></span>
                <span className="tabular-nums">{formatCedis(Number(it.subtotal))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{formatCedis(Number(order.subtotal))}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery{order.delivery_fee_adjusted ? " (updated by store)" : ""}</dt>
              <dd className="tabular-nums">{Number(order.delivery_fee) === 0 ? "Free" : formatCedis(Number(order.delivery_fee))}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCedis(Number(order.total))}</dd></div>
          </dl>
          <p className="mt-3 rounded-lg bg-paper px-3 py-2.5 text-sm">
            {paid
              ? "Paid. Thank you!"
              : order.payment_method === "pay_on_delivery"
                ? cancelled ? "Pay on delivery" : <>Pay <strong>{formatCedis(Number(order.total))}</strong> to the rider (cash or MoMo).</>
                : cancelled ? "Online payment (not paid)" : "MoMo or card: not paid yet"}
          </p>
        </section>

        {/* Delivery details + timeline */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm" aria-labelledby="delivery-title">
            <h2 id="delivery-title" className="font-semibold">Delivery to</h2>
            <p className="mt-2 font-medium">{order.customer_name} · {formatGhanaPhone(order.customer_phone)}</p>
            <p className="mt-1 flex gap-2 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{[order.digital_address, order.landmark, order.area, order.city].filter(Boolean).join(", ") || "Location on map"}</span>
            </p>
            {(order.delivery_zone_name || order.delivery_distance_km !== null) && (
              <p className="mt-1 text-muted">{order.delivery_zone_name ?? `About ${Number(order.delivery_distance_km)} km from the store`}</p>
            )}
            {order.notes && <p className="mt-3 rounded-lg bg-paper px-3 py-2">Your note: {order.notes}</p>}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 text-sm" aria-labelledby="updates-title">
            <h2 id="updates-title" className="font-semibold">Updates</h2>
            <ol className="mt-3 space-y-3">
              {[...order.timeline].reverse().map((t, i) => (
                <li key={`${t.at}-${i}`} className="flex gap-3">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i === 0 ? "bg-(--store)" : "bg-line-strong")} aria-hidden="true" />
                  <span>
                    <span className="block">{t.note ?? HEADLINE[t.status]}</span>
                    <span className="text-xs text-muted">{formatDateTime(t.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {canCancel && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 text-sm">
          <p className="text-muted">Changed your mind? You can cancel until the store confirms.</p>
          <ActionForm
            action={cancelOrder}
            hidden={{ token, storeSlug: order.store.slug }}
            confirm={{ title: `Cancel order #${order.order_number}?`, body: "The store will be told your order is cancelled.", confirmLabel: "Cancel order", danger: true }}
          >
            <button className="inline-flex h-10 items-center rounded-full border border-danger/40 px-4 font-medium text-danger hover:bg-danger-soft">Cancel order</button>
          </ActionForm>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted">
        {!signedIn && (
          <p>
            Want all your orders in one place?{" "}
            <a href={`${env.siteUrl}/signup?next=${encodeURIComponent(`${env.siteUrl}/account`)}`} className="font-medium text-ink underline">Create a free account</a>
          </p>
        )}
        <Link href={base || "/"} className="font-medium text-ink underline">Continue shopping</Link>
      </div>
    </div>
  );
}
