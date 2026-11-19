"use client";

import { useCallback, useSyncExternalStore } from "react";

// The cart lives in the shopper's browser (localStorage), one per store.
// Prices saved here are only for showing the cart quickly: the cart page and
// checkout always re-price everything from the database.

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock?: number; // last known stock, to stop obviously impossible quantities
};

export const MAX_LINES = 50;
export const MAX_QTY = 999;

const key = (store: string) => `akwaaba:cart:${store}`;
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();

function isLine(x: unknown): x is CartLine {
  if (!x || typeof x !== "object") return false;
  const l = x as Record<string, unknown>;
  return typeof l.productId === "string" && /^[0-9a-f-]{36}$/i.test(l.productId) &&
    typeof l.name === "string" && typeof l.slug === "string" && typeof l.price === "number" &&
    Number.isInteger(l.quantity) && (l.quantity as number) >= 1;
}

// In-memory fallback when localStorage is blocked (private mode on some phones)
const memory = new Map<string, string>();

function getRaw(store: string): string | null {
  try {
    return window.localStorage.getItem(key(store));
  } catch {
    return memory.get(store) ?? null;
  }
}

function read(store: string): CartLine[] {
  const raw = getRaw(store);
  const hit = cache.get(store);
  if (hit && hit.raw === raw) return hit.lines;
  let lines: CartLine[] = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      lines = Array.isArray(parsed) ? parsed.filter(isLine).slice(0, MAX_LINES).map((l) => ({ ...l, quantity: Math.min(l.quantity, MAX_QTY) })) : EMPTY;
    } catch {
      lines = EMPTY;
    }
  }
  cache.set(store, { raw, lines });
  return lines;
}

function write(store: string, lines: CartLine[]) {
  const raw = JSON.stringify(lines);
  try {
    window.localStorage.setItem(key(store), raw);
  } catch {
    memory.set(store, raw);
  }
  cache.set(store, { raw, lines });
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("akwaaba:cart:")) cb(); // another tab changed the cart
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(store: string) {
  const lines = useSyncExternalStore(
    subscribe,
    () => read(store),
    () => EMPTY, // server render: empty, filled in after hydration
  );
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  // Returns how many were actually added; `limit` says why fewer were added
  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1): { added: number; limit?: "stock" | "full" } => {
    const current = read(store);
    const existing = current.find((l) => l.productId === line.productId);
    const limit = Math.min(MAX_QTY, line.stock ?? MAX_QTY);
    const before = existing?.quantity ?? 0;
    const after = Math.min(before + quantity, limit);
    if (!existing && current.length >= MAX_LINES) return { added: 0, limit: "full" };
    const next = existing
      ? current.map((l) => (l.productId === line.productId ? { ...l, ...line, quantity: after } : l))
      : [...current, { ...line, quantity: after }];
    if (after > 0) write(store, next);
    return { added: after - before, limit: after < before + quantity ? "stock" : undefined };
  }, [store]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const q = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)));
    write(store, read(store).map((l) => (l.productId === productId ? { ...l, quantity: q } : l)));
  }, [store]);

  const remove = useCallback((productId: string) => {
    write(store, read(store).filter((l) => l.productId !== productId));
  }, [store]);

  // Refresh saved names/prices/photos with the latest from the database
  const refresh = useCallback((updates: Map<string, Partial<CartLine>>) => {
    const current = read(store);
    let changed = false;
    const next = current.map((l) => {
      const u = updates.get(l.productId);
      if (!u) return l;
      const merged = { ...l, ...u };
      if (merged.name !== l.name || merged.price !== l.price || merged.image !== l.image || merged.stock !== l.stock) changed = true;
      return merged;
    });
    if (changed) write(store, next);
  }, [store]);

  const clear = useCallback(() => write(store, []), [store]);

  return { lines, count, add, setQuantity, remove, refresh, clear };
}
