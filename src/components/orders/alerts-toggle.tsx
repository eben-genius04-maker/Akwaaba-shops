"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { playChime, readPrefs, unlockSound, writePrefs, type AlertPrefs } from "./alerts";

// Sound on/off and phone/computer pop-up notifications for new orders
export function AlertsToggle() {
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setPrefs(readPrefs()), 0);
    return () => clearTimeout(t);
  }, []);
  if (!prefs) return null;

  const supportsNotify = typeof Notification !== "undefined";
  const update = (p: AlertPrefs) => {
    setPrefs(p);
    writePrefs(p);
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          unlockSound();
          const next = { ...prefs, sound: !prefs.sound };
          update(next);
          if (next.sound) setTimeout(playChime, 50);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-paper"
        aria-pressed={prefs.sound}
      >
        {prefs.sound ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
        {prefs.sound ? "Sound on" : "Sound off"}
      </button>
      {supportsNotify && (
        <button
          type="button"
          onClick={async () => {
            if (prefs.notify) return update({ ...prefs, notify: false });
            const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
            if (permission !== "granted") {
              toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
              return;
            }
            update({ ...prefs, notify: true });
            toast.success("You'll get a pop-up for new orders while the dashboard is open.");
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-paper"
          aria-pressed={prefs.notify}
        >
          {prefs.notify ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
          {prefs.notify ? "Pop-ups on" : "Pop-ups off"}
        </button>
      )}
    </div>
  );
}
