"use client";

import { useEffect } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window { __akwaabaInstall?: InstallPrompt | null }
}

// Registers the service worker (offline page) and keeps Chrome's "install"
// offer so our own "Install app" buttons can use it.
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__akwaabaInstall = e as InstallPrompt;
      window.dispatchEvent(new Event("akwaaba:installable"));
    };
    const onInstalled = () => {
      window.__akwaabaInstall = null;
      window.dispatchEvent(new Event("akwaaba:installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
