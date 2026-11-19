"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { allowIp } from "@/lib/rate-limit";

const itemsSchema = z
  .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
  .min(1)
  .max(50);

export type PricedLine = {
  product_id: string;
  name: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};
export type CartIssue = {
  product_id: string;
  name: string | null;
  problem: "not_found" | "unavailable" | "out_of_stock" | "insufficient_stock";
  available: number | null;
};
export type PricedCart =
  | { ok: true; lines: PricedLine[]; issues: CartIssue[]; subtotal: number; freeDeliveryMin: number | null; deliveryEnabled: boolean; storeActive: boolean }
  | { ok: false; error: string };

// Prices the cart from the database: current prices, stock and availability.
export async function priceCart(storeSlug: string, items: { productId: string; quantity: number }[]): Promise<PricedCart> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success || typeof storeSlug !== "string") return { ok: false, error: "Your cart couldn't be read. Please refresh the page." };
  if (!(await allowIp("cart", 120, 60))) return { ok: false, error: "Too many requests. Please wait a moment and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cart", {
    p_store_slug: storeSlug,
    p_items: parsed.data.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
  });
  if (error || !data) {
    return { ok: false, error: error?.code === "P0002" ? "This store isn't available right now." : "We couldn't check your cart. Please try again." };
  }
  const d = data as {
    lines: PricedLine[]; issues: CartIssue[]; subtotal: number | string;
    free_delivery_min: number | string | null; delivery_enabled: boolean; store_active: boolean;
  };
  return {
    ok: true,
    lines: d.lines.map((l) => ({ ...l, unit_price: Number(l.unit_price), subtotal: Number(l.subtotal) })),
    issues: d.issues,
    subtotal: Number(d.subtotal),
    freeDeliveryMin: d.free_delivery_min === null ? null : Number(d.free_delivery_min),
    deliveryEnabled: d.delivery_enabled,
    storeActive: d.store_active,
  };
}
