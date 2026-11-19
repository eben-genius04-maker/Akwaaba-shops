"use client";

// New-order alert preferences (saved in this browser) and the alert sound.

export type AlertPrefs = { sound: boolean; notify: boolean };
const KEY = "akwaaba:order-alerts";

export function readPrefs(): AlertPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : {};
    return { sound: p.sound !== false, notify: p.notify === true };
  } catch {
    return { sound: true, notify: false };
  }
}

export function writePrefs(p: AlertPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked: preferences last until the page closes
  }
  window.dispatchEvent(new CustomEvent("akwaaba:alert-prefs", { detail: p }));
}

let ctx: AudioContext | null = null;

// Browsers only allow sound after the person has tapped the page once
export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

// Two short rising tones
export function playChime() {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.3);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.32);
  });
}
