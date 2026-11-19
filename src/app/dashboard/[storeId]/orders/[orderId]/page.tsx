import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Mail, MapPin, MessageCircle, Navigation, Package, Phone, Send } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { OrderActions } from "@/components/orders/order-actions";
import { FeeAdjust } from "@/components/orders/fee-adjust";
import { StaffNotes } from "@/components/orders/staff-notes";
import { PrintButton } from "@/components/orders/print-button";
import { whatsappLink } from "@/components/storefront/whatsapp";
import { formatCedis, formatDateTime, formatGhanaPhone } from "@/lib/format";
import { mapsLink, STATUS_LABEL } from "@/lib/orders";
import { thumbUrl } from "@/lib/storage";
import { storeUrl } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/dashboard/[storeId]/orders/[orderId]">): Promise<Metadata> {
  const { storeId, orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { title: "Order" };
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("order_number").eq("id", orderId).eq("store_id", storeId).maybeSingle();
  return { title: data ? `Order #${data.order_number}` : "Order" };
}

export default async function OrderDetailPage({ params }: PageProps<"/dashboard/[storeId]/orders/[orderId]">) {
  const { storeId, orderId } = await params;
  const { store } = await requireStoreAccess(storeId);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();

  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(product_name, image_url, unit_price, quantity, subtotal, delivery_size), order_status_history(id, status, note, created_at, changed_by)")
    .eq("id", orderId)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!o) notFound();

  const history = [...o.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  // Names of teammates who made changes (customers' names aren't visible to the team)
  const ids = [...new Set(history.map((h) => h.changed_by).filter((x): x is string => !!x))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = (id: string | null) => {
    const p = people?.find((x) => x.id === id);
    return p ? p.full_name ?? p.email ?? "Team member" : "Customer";
  };

  const st = STATUS_LABEL[o.status];
  const canManage = store.role === "owner" || store.role === "manager";
  const cod = o.payment_method === "pay_on_delivery";
  const paid = o.payment_status === "paid";
  const hasPin = o.delivery_lat !== null && o.delivery_lng !== null;
  const address = [o.digital_address, o.landmark, o.area, o.city].filter(Boolean).join(", ");
  const phone = formatGhanaPhone(o.customer_phone);
  const firstName = o.customer_name.split(" ")[0];
  const trackingUrl = `${storeUrl(store.slug)}/order/${o.tracking_token}`;
  const canChangeFee = canManage && o.status === "pending" && ["unpaid", "failed"].includes(o.payment_status);

  // Ready-made message for the store's own rider
  const riderText = [
    `Delivery for ${store.name}: order #${o.order_number}`,
    `Customer: ${o.customer_name}, ${phone}`,
    address && `Address: ${address}`,
    hasPin && `Map: ${mapsLink(o.delivery_lat!, o.delivery_lng!)}`,
    `Items: ${o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}`,
    paid ? "Already paid: collect nothing." : `Collect: ${formatCedis(Number(o.total))} (cash or MoMo)`,
    o.notes && `Customer note: ${o.notes}`,
  ].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader
        back={{ href: `/dashboard/${store.id}/orders`, label: "Orders" }}
        title={`Order #${o.order_number}`}
        description={<>Placed {formatDateTime(o.created_at)} · <Badge tone={st.tone}>{st.label}</Badge> {paid && <Badge tone="success">Paid</Badge>}</>}
        actions={<PrintButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <OrderActions
            storeId={store.id}
            orderId={o.id}
            orderNumber={o.order_number}
            status={o.status}
            canCancel={canManage}
            waitingForPayment={o.status === "pending" && o.payment_method === "prepaid" && !paid}
            payOnDelivery={cod && !paid}
          />

          {o.status === "cancelled" && (
            <p className="rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
              Cancelled{o.cancelled_at ? ` ${formatDateTime(o.cancelled_at)}` : ""}{o.cancel_reason ? `: ${o.cancel_reason}` : ""}
              {paid && " · Refund due to the customer."}
            </p>
          )}

          {/* Items */}
          <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="items-h">
            <h2 id="items-h" className="font-semibold">Items</h2>
            <ul className="mt-3 divide-y divide-line">
              {o.order_items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 py-3 text-sm">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl(it.image_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="m-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{it.product_name}</span>
                    <span className="text-muted">{it.quantity} × {formatCedis(Number(it.unit_price))}{it.delivery_size !== "small" ? ` · ${it.delivery_size} item` : ""}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatCedis(Number(it.subtotal))}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{formatCedis(Number(o.subtotal))}</dd></div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">
                  Delivery{o.delivery_zone_name ? ` · ${o.delivery_zone_name}` : o.delivery_distance_km !== null ? ` · ${Number(o.delivery_distance_km)} km` : ""}
                  {o.delivery_fee_adjusted && " (changed)"}
                  {canChangeFee && <div><FeeAdjust storeId={store.id} orderId={o.id} current={Number(o.delivery_fee)} /></div>}
                </dt>
                <dd className="tabular-nums">{Number(o.delivery_fee) === 0 ? "Free" : formatCedis(Number(o.delivery_fee))}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCedis(Number(o.total))}</dd></div>
            </dl>
            <p className="mt-3 rounded-lg bg-paper px-3 py-2.5 text-sm">
              {paid ? `Paid${o.paid_at ? ` ${formatDateTime(o.paid_at)}` : ""}${cod ? " (on delivery)" : " online"}.` : cod ? <>Pay on delivery: rider collects <strong>{formatCedis(Number(o.total))}</strong>.</> : "Online payment: not paid yet."}
            </p>
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="history-h">
            <h2 id="history-h" className="font-semibold">History</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{STATUS_LABEL[h.status].label}</span>
                    {h.note && <span className="text-ink/80"> · {h.note}</span>}
                    <span className="block text-xs text-muted">{formatDateTime(h.created_at)} · {h.changed_by ? who(h.changed_by) : "Customer"}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          {/* Customer */}
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm" aria-labelledby="cust-h">
            <h2 id="cust-h" className="font-semibold">Customer</h2>
            <p className="mt-2 font-medium">{o.customer_name}</p>
            <p className="text-muted">{phone}{o.customer_user_id ? " · has an account" : " · guest"}</p>
            {o.customer_email && <p className="mt-1 flex items-center gap-1.5 text-muted"><Mail className="h-3.5 w-3.5" aria-hidden="true" /> {o.customer_email}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
              <a href={`tel:+${o.customer_phone}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong font-medium hover:bg-paper"><Phone className="h-4 w-4" aria-hidden="true" /> Call</a>
              <a href={whatsappLink(o.customer_phone, `Hello ${firstName}, this is ${store.name} about your order #${o.order_number}.`)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#177a43] font-medium text-white hover:bg-[#11612f]"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</a>
            </div>
            {o.notes && <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-ink">Note: {o.notes}</p>}
          </section>

          {/* Delivery */}
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm" aria-labelledby="del-h">
            <h2 id="del-h" className="font-semibold">Delivery</h2>
            <p className="mt-2 flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> <span>{address || "No written address: use the map pin."}</span></p>
            {o.delivery_zone_name && <p className="mt-1 text-muted">Area: {o.delivery_zone_name}</p>}
            {o.delivery_distance_km !== null && <p className="mt-1 text-muted">About {Number(o.delivery_distance_km)} km by road</p>}
            {hasPin && (
              <a href={mapsLink(o.delivery_lat!, o.delivery_lng!)} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong font-medium hover:bg-paper print:hidden">
                <Navigation className="h-4 w-4" aria-hidden="true" /> Directions in Google Maps
              </a>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2 print:hidden">
              <CopyButton text={riderText} label="Copy for rider" icon={<Copy className="h-4 w-4" aria-hidden="true" />} />
              <a href={`https://wa.me/?text=${encodeURIComponent(riderText)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong font-medium hover:bg-paper"><Send className="h-4 w-4" aria-hidden="true" /> Send to rider</a>
            </div>
            <p className="mt-2 text-xs text-muted print:hidden">Sends the address, map link and amount to collect on WhatsApp.</p>
          </section>

          {/* Team notes */}
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm" aria-labelledby="notes-h">
            <h2 id="notes-h" className="font-semibold">Team notes</h2>
            <p className="mb-2 mt-1 text-xs text-muted">Only your team sees these.</p>
            <StaffNotes storeId={store.id} orderId={o.id} initial={o.staff_notes ?? ""} />
          </section>

          <a href={trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink print:hidden">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> See what the customer sees
          </a>
        </aside>
      </div>
    </>
  );
}
