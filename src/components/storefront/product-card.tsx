import Link from "next/link";
import { Package } from "lucide-react";
import { formatCedis } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { QuickAdd } from "./quick-add";

export type CardProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock: number;
  available: boolean;
  image: string | null;
};

export function ProductCard({ product: p, base, priority }: { product: CardProduct; base: string; priority?: boolean }) {
  const soldOut = !p.available || p.stock === 0;
  const href = `${base}/p/${p.slug}`;
  return (
    <div className="group relative flex flex-col">
      <Link href={href} aria-label={p.name} tabIndex={-1} className="block overflow-hidden rounded-xl bg-surface ring-1 ring-line">
        <div className="relative aspect-square">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl(p.image)}
              alt=""
              loading={priority ? "eager" : "lazy"}
              width={480}
              height={480}
              className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${soldOut ? "opacity-60" : ""}`}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted"><Package className="h-8 w-8" aria-hidden="true" /></span>
          )}
          {soldOut ? (
            <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-medium text-paper">Sold out</span>
          ) : p.stock <= 3 ? (
            <span className="absolute left-2 top-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-warning">Only {p.stock} left</span>
          ) : null}
        </div>
      </Link>
      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <Link href={href} className="min-w-0">
          <p className="line-clamp-2 text-sm leading-snug">{p.name}</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatCedis(p.price)}</p>
        </Link>
        {!soldOut && <QuickAdd product={p} />}
      </div>
    </div>
  );
}
