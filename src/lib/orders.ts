import type { Enums } from "@/types/database";

export type OrderStatus = Enums<"order_status">;
export type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

// How statuses are shown in the store dashboard
export const STATUS_LABEL: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "New", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "brand" },
  processing: { label: "Preparing", tone: "brand" },
  out_for_delivery: { label: "Out for delivery", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

// Next steps the store can take (same rules as update_order_status() in the database)
export const NEXT_STEPS: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  pending: [{ status: "confirmed", label: "Confirm order" }],
  confirmed: [{ status: "processing", label: "Start preparing" }, { status: "out_for_delivery", label: "Out for delivery" }],
  processing: [{ status: "out_for_delivery", label: "Out for delivery" }],
  out_for_delivery: [{ status: "delivered", label: "Mark as delivered" }],
  delivered: [],
  cancelled: [],
};

// Order list tabs
export const ORDER_TABS = {
  new: { label: "New", statuses: ["pending"] as OrderStatus[] },
  active: { label: "In progress", statuses: ["confirmed", "processing", "out_for_delivery"] as OrderStatus[] },
  delivered: { label: "Delivered", statuses: ["delivered"] as OrderStatus[] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] as OrderStatus[] },
  all: { label: "All", statuses: [] as OrderStatus[] },
} as const;
export type OrderTab = keyof typeof ORDER_TABS;

// "5 min ago", "3 h ago", "12 Nov"
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 2) return "yesterday";
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", timeZone: "Africa/Accra" });
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
