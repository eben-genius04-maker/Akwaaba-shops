import Link from "next/link";
import { cn } from "@/lib/cn";

// The Akwaaba Shops mark: a shopping bag that is also an open doorway ("Akwaaba" means
// welcome) with the Sankofa heart and kente stripes. Made by `npm run icons`.
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/mark.png" alt="" aria-hidden="true" width={32} height={32} className={cn("h-8 w-8 shrink-0 rounded-lg", className)} />
  );
}

export function Logo({ href = "/", className, light = false }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Akwaaba Shops home">
      <LogoMark />
      <span className={cn("text-lg font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
        Akwaaba <span className={light ? "text-gold" : "text-brand"}>Shops</span>
      </span>
    </Link>
  );
}
