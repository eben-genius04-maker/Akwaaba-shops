import { z } from "zod";
import { GHANA_BOUNDS } from "@/lib/delivery";

const checkbox = z.union([z.literal("on"), z.literal(""), z.null(), z.undefined()]).transform((v) => v === "on");
const clean = (v: string) => v.replace(/[,\s]|GH₵|GHS/gi, "");

// Cedi amount, e.g. "15" or "12.50". Returns null when empty.
const parseAmount = (raw: string, ctx: z.RefinementCtx, max: number, positive = false): number | null | typeof z.NEVER => {
  const v = clean(raw);
  if (!v) return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(v)) {
    ctx.addIssue({ code: "custom", message: "Enter an amount like 15 or 12.50." });
    return z.NEVER;
  }
  const n = Number(v);
  if (n > max) {
    ctx.addIssue({ code: "custom", message: `That's too high (max GH₵${max.toLocaleString()}).` });
    return z.NEVER;
  }
  if (positive && n <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter an amount above 0, or leave it empty." });
    return z.NEVER;
  }
  return n;
};

const requiredAmount = (label: string, max: number) =>
  z.string().trim().transform((raw, ctx): number => {
    const n = parseAmount(raw, ctx, max);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: `Enter ${label}.` });
      return z.NEVER;
    }
    return n;
  });

const optionalAmount = (max: number, positive = false) =>
  z.string().trim().transform((raw, ctx): number | null => parseAmount(raw, ctx, max, positive));

const amountOrZero = (max: number) =>
  z.string().trim().transform((raw, ctx): number => parseAmount(raw, ctx, max) ?? 0);

const coordinate = (min: number, max: number) =>
  z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: "Pick a location in Ghana on the map." });
      return z.NEVER;
    }
    return Math.round(n * 1e6) / 1e6;
  });

export const deliverySettingsSchema = z
  .object({
    deliveryEnabled: checkbox,
    method: z.enum(["zones", "distance"], { message: "Choose how you charge for delivery." }),
    pickupAddress: z.string().trim().max(300, "Address is too long (max 300 characters).").transform((v) => v || null),
    pickupLat: coordinate(GHANA_BOUNDS.minLat, GHANA_BOUNDS.maxLat),
    pickupLng: coordinate(GHANA_BOUNDS.minLng, GHANA_BOUNDS.maxLng),
    baseFee: requiredAmount("a starting fee", 10000),
    perKmFee: requiredAmount("a price per km", 1000),
    maxDistanceKm: z.string().trim().transform((raw, ctx) => {
      const v = clean(raw).replace(/km$/i, "");
      if (!v) return null;
      if (!/^\d{1,4}(\.\d)?$/.test(v) || Number(v) <= 0 || Number(v) > 1000) {
        ctx.addIssue({ code: "custom", message: "Enter a distance like 25, or leave it empty for no limit." });
        return z.NEVER;
      }
      return Number(v);
    }),
    roadFactor: z.string().trim().transform((v, ctx) => {
      if (!v) return 1.3;
      const n = Number(v);
      if (!/^\d(\.\d{1,2})?$/.test(v) || n < 1 || n > 2) {
        ctx.addIssue({ code: "custom", message: "Enter a number from 1.00 to 2.00." });
        return z.NEVER;
      }
      return n;
    }),
    mediumSurcharge: amountOrZero(10000),
    largeSurcharge: amountOrZero(10000),
    freeDeliveryMin: optionalAmount(1000000),
    deliveryNote: z.string().trim().max(500, "Note is too long (max 500 characters).").transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    if ((d.pickupLat === null) !== (d.pickupLng === null)) {
      ctx.addIssue({ code: "custom", path: ["pickupLat"], message: "Pick your shop's location on the map." });
    }
    if (d.method === "distance" && d.pickupLat === null) {
      ctx.addIssue({ code: "custom", path: ["pickupLat"], message: "Distance pricing needs your shop's location. Drop a pin on the map." });
    }
  });

export const deliveryZoneSchema = z.object({
  name: z.string().trim().min(2, "Enter an area name, e.g. Teshie / Nungua.").max(80, "Name is too long (max 80 characters)."),
  description: z.string().trim().max(300, "Too long (max 300 characters).").transform((v) => v || null),
  fee: requiredAmount("the delivery fee for this area", 10000),
  isActive: checkbox,
});

export const paymentSettingsSchema = z.object({
  codEnabled: checkbox,
  codMaxAmount: optionalAmount(1000000, true),
  prepaidEnabled: checkbox,
});
