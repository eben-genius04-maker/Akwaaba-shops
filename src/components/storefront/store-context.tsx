"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StoreInfo = {
  slug: string;
  base: string; // "" on the store's subdomain, "/s/{slug}" on the main domain
  name: string;
  whatsapp: string | null;
  active: boolean;
};

const StoreContext = createContext<StoreInfo | null>(null);

export function StoreProvider({ store, children }: { store: StoreInfo; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreInfo {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside a storefront");
  return s;
}

// "/" → store home, "/cart" → cart page, etc.
export function storeHref(base: string, path: string): string {
  if (path === "/" || path === "") return base || "/";
  return `${base}${path}`;
}
