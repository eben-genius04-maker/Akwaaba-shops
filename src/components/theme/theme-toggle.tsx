"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, type ThemeChoice } from "./theme";
import { cn } from "@/lib/cn";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "Auto" };

// One button that cycles Auto (follows the phone) → Light → Dark
export function ThemeToggle({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setChoice(readTheme()), 0);
    // "Auto" follows the phone/computer setting as it changes (e.g. at night)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => readTheme() === "system" && applyTheme("system");
    const onOther = (e: Event) => setChoice((e as CustomEvent<ThemeChoice>).detail);
    mq.addEventListener("change", onSystem);
    window.addEventListener("akwaaba:theme", onOther);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", onSystem);
      window.removeEventListener("akwaaba:theme", onOther);
    };
  }, []);

  const current = choice ?? "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[current];
        applyTheme(next);
        setChoice(next);
      }}
      className={cn("inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink", className)}
      aria-label={`Theme: ${LABEL[current]}. Change theme`}
      title={`Theme: ${LABEL[current]} (tap to change)`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {withLabel && <span>{LABEL[current]} theme</span>}
    </button>
  );
}
