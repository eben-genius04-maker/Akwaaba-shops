"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/cn";

// "Install app" button. Android/Chrome/Edge: opens the browser's install box.
// iPhone (Safari can't do this automatically): shows how to add it to the home screen.
// Hidden when the app is already installed or the browser can't install it.
export function InstallButton({ label = "Install app", className }: { label?: string; className?: string }) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const sync = () => setCanPrompt(!standalone && !!window.__akwaabaInstall);
    const t = setTimeout(() => {
      sync();
      setIos(!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));
    }, 0);
    window.addEventListener("akwaaba:installable", sync);
    return () => {
      clearTimeout(t);
      window.removeEventListener("akwaaba:installable", sync);
    };
  }, []);

  if (!canPrompt && !ios) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const p = window.__akwaabaInstall;
          if (p) {
            await p.prompt();
            await p.userChoice.catch(() => null);
            window.__akwaabaInstall = null;
            setCanPrompt(false);
          } else {
            setHelp(true);
          }
        }}
        className={cn("inline-flex items-center gap-2 text-sm font-medium", className)}
      >
        <Download className="h-4 w-4" aria-hidden="true" /> {label}
      </button>
      {help && (
        <div role="dialog" aria-label="Add to Home Screen" className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-line bg-surface p-4 text-sm text-ink shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <p>
              Tap <Share className="mx-0.5 inline h-4 w-4 align-text-bottom" aria-label="Share" /> <strong>Share</strong> at the bottom of Safari,
              then <strong>Add to Home Screen</strong>.
            </p>
            <button type="button" onClick={() => setHelp(false)} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
