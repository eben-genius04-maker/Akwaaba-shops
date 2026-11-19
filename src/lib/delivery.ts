// Delivery helpers shared by the dashboard and (later) the storefront.
// The database always calculates the real fee at checkout; these are only
// for previews, and use the same formula as public._delivery_fee().

export type LatLng = { lat: number; lng: number };

// Same limits as the database checks on pickup/customer locations
export const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 } as const;
export const ACCRA_CENTER: LatLng = { lat: 5.6037, lng: -0.187 };

export function isInGhana(p: LatLng): boolean {
  return (
    p.lat >= GHANA_BOUNDS.minLat && p.lat <= GHANA_BOUNDS.maxLat &&
    p.lng >= GHANA_BOUNDS.minLng && p.lng <= GHANA_BOUNDS.maxLng
  );
}

// Straight-line distance in km
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type DistancePricing = {
  baseFee: number;
  perKmFee: number;
  maxDistanceKm: number | null;
  roadFactor: number;
};

// Fee for a road distance (km) plus any size surcharge, before free delivery.
// Returns null when the distance is beyond the store's limit.
export function distanceFee(roadKm: number, p: Omit<DistancePricing, "roadFactor">, surcharge = 0): number | null {
  const km = Math.round(roadKm * 10) / 10;
  if (p.maxDistanceKm !== null && km > p.maxDistanceKm) return null;
  return Math.ceil(p.baseFee + p.perKmFee * km + surcharge);
}

// Parses a form number like "12", "12.50" or "GH₵ 1,200"; returns null if empty/invalid
export function parseAmount(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = v.replace(/[,\s]|GH₵|GHS/gi, "");
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

// 12 → "12", 12.5 → "12.50": for putting saved amounts back into form fields
export function amountInput(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
