import { extendTailwindMerge } from "tailwind-merge";

// Our theme colours, so "text-ink" correctly overrides "text-white" (and not a font size)
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "brand", "brand-hover", "brand-soft", "clay", "danger", "danger-soft", "gold", "gold-soft", "ink",
        "line", "line-strong", "muted", "paper", "success", "success-soft", "surface", "warning", "warning-soft",
        "on-brand", "on-danger", "on-gold",
      ],
    },
  },
});

// Joins class names, skipping empty values, and lets later classes win
// over earlier ones: cn("bg-brand text-white", "text-ink") → "bg-brand text-ink"
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}
