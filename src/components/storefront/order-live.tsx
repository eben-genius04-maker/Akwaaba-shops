"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps the tracking page fresh: checks for updates every 30 seconds and when
// the customer comes back to the tab. Stops once the order is finished.
export function OrderAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 30000);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, router]);
  return null;
}
