"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getOrderPulse } from "@/actions/orders";
import { formatCedis } from "@/lib/format";
import { playChime, readPrefs, unlockSound } from "./alerts";

const EVERY_MS = 20000;

// Watches for new orders while any dashboard page is open: sound, pop-up,
// a count in the browser tab, and the badge on "Orders" in the menu.
export function OrderPulse({ storeId, initialPending, initialLatestId }: { storeId: string; initialPending: number; initialLatestId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const latestId = useRef(initialLatestId);
  const pending = useRef(initialPending);
  const pathRef = useRef(pathname);

  // Browser tab title: "(2) Orders · Akwaaba Shops". Next.js rewrites the title on
  // navigation and refresh, so re-apply the count whenever the title changes.
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const apply = () => {
      const clean = document.title.replace(/^\(\d+\) /, "");
      const want = pending.current > 0 ? `(${pending.current}) ${clean}` : clean;
      if (document.title !== want) document.title = want;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    const onCount = () => apply();
    window.addEventListener("akwaaba:pending-orders", onCount);
    return () => {
      observer.disconnect();
      window.removeEventListener("akwaaba:pending-orders", onCount);
    };
  }, []);

  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock, { once: true });

    let stopped = false;
    async function check() {
      const pulse = await getOrderPulse(storeId).catch(() => null);
      if (!pulse || stopped) return;
      const ordersBase = `/dashboard/${storeId}/orders`;

      if (pulse.latest && pulse.latest.id !== latestId.current) {
        latestId.current = pulse.latest.id;
        const o = pulse.latest;
        const prefs = readPrefs();
        if (prefs.sound) playChime();
        toast(`New order #${o.number}`, {
          description: `${o.name} · ${formatCedis(o.total)}`,
          duration: 15000,
          action: { label: "View", onClick: () => router.push(`${ordersBase}/${o.id}`) },
        });
        if (prefs.notify && document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification(`New order #${o.number}`, { body: `${o.name} · ${formatCedis(o.total)}`, tag: `order-${o.id}` });
          n.onclick = () => {
            window.focus();
            router.push(`${ordersBase}/${o.id}`);
          };
        }
      }

      if (pulse.pending !== pending.current) {
        pending.current = pulse.pending;
        window.dispatchEvent(new CustomEvent("akwaaba:pending-orders", { detail: pulse.pending }));
        // Keep the orders list and overview up to date
        const p = pathRef.current;
        if (p === ordersBase || p === `/dashboard/${storeId}`) router.refresh();
      }
    }

    const id = setInterval(check, EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [storeId, router]);

  return null;
}
