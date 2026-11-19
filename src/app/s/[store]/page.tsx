import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { coverImage, getPublicDeliveryInfo, getStoreBase, getStorefront, likePattern } from "@/lib/storefront";
import { formatCedis } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";

const PAGE_SIZE = 24;
const SORTS = {
  new: { label: "Newest", column: "created_at", ascending: false },
  "price-asc": { label: "Price: low to high", column: "price", ascending: true },
  "price-desc": { label: "Price: high to low", column: "price", ascending: false },
} as const;
type SortKey = keyof typeof SORTS;

const PRODUCT_FIELDS = "id, name, slug, price, stock_quantity, is_available, product_images(image_url, sort_order, is_primary)";

type Row = {
  id: string; name: string; slug: string; price: number; stock_quantity: number; is_available: boolean;
  product_images: { image_url: string; sort_order: number; is_primary: boolean }[];
};
const toCard = (p: Row): CardProduct => ({
  id: p.id, slug: p.slug, name: p.name, price: Number(p.price), stock: p.stock_quantity, available: p.is_available, image: coverImage(p.product_images),
});

export async function generateMetadata({ params }: PageProps<"/s/[store]">): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  if (!store) return { title: "Store not found" };
  const image = store.heroImageUrl ?? store.logoUrl;
  return {
    title: { absolute: store.name },
    description: store.description ?? `Shop online at ${store.name}. Order from your phone and get it delivered.`,
    openGraph: { title: store.name, description: store.description ?? undefined, images: image ? [image] : undefined },
    robots: store.status === "active" ? undefined : { index: false },
  };
}

export default async function StorefrontHome({ params, searchParams }: PageProps<"/s/[store]">) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const store = await getStorefront(slug);
  if (!store) notFound();
  const base = await getStoreBase(store.slug);
  const home = base || "/";

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const categorySlug = typeof sp.category === "string" ? sp.category : "";
  const sort: SortKey = typeof sp.sort === "string" && sp.sort in SORTS ? (sp.sort as SortKey) : "new";
  const page = Math.min(20, Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1));
  const filtering = !!q || !!categorySlug || sort !== "new";

  const supabase = await createClient();
  const [{ data: categories }, delivery] = await Promise.all([
    supabase.from("categories").select("id, name, slug, image_url").eq("store_id", store.id).eq("is_active", true).order("sort_order").order("name"),
    getPublicDeliveryInfo(store.slug),
  ]);
  const category = categories?.find((c) => c.slug === categorySlug) ?? null;

  let query = supabase
    .from("products")
    .select(PRODUCT_FIELDS, { count: "exact" })
    .eq("store_id", store.id)
    .eq("is_active", true);
  if (q) query = query.ilike("name", likePattern(q));
  if (category) query = query.eq("category_id", category.id);
  const s = SORTS[sort];
  const { data: rows, count } = await query
    .order(s.column, { ascending: s.ascending })
    .order("id")
    .range(0, page * PAGE_SIZE - 1);
  const products = ((rows ?? []) as Row[]).map(toCard);
  const total = count ?? 0;

  const featured = filtering
    ? []
    : (((await supabase.from("products").select(PRODUCT_FIELDS).eq("store_id", store.id).eq("is_active", true).eq("is_featured", true).order("updated_at", { ascending: false }).limit(8)).data ?? []) as Row[]).map(toCard);

  // Builds a link that keeps the other filters
  const link = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { q: q || null, category: category?.slug ?? null, sort: sort === "new" ? null : sort, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const str = next.toString();
    return `${home}${str ? `?${str}` : ""}#products`;
  };

  return (
    <>
      {!filtering && (
        <section className="relative overflow-hidden bg-(--store) text-(--store-ink)">
          {store.heroImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/35 to-black/10" />
            </>
          )}
          <div className={cn("relative mx-auto max-w-6xl px-4", store.heroImageUrl ? "py-16 text-white sm:py-24" : "py-10 sm:py-14")}>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">{store.heroTitle ?? store.name}</h1>
            {(store.heroSubtitle ?? store.description) && (
              <p className="mt-3 max-w-xl text-base opacity-90 sm:text-lg">{store.heroSubtitle ?? store.description}</p>
            )}
            <a href="#products" className={cn("mt-6 inline-flex h-11 items-center rounded-full px-6 font-medium shadow-sm", store.heroImageUrl ? "bg-white text-ink" : "bg-(--store-ink) text-(--store)")}>
              Shop now
            </a>
          </div>
        </section>
      )}

      {delivery?.enabled && delivery.freeDeliveryMin !== null && (
        <div className="border-b border-line bg-surface">
          <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm">
            <Truck className="h-4 w-4 shrink-0 text-(--store)" aria-hidden="true" />
            {delivery.freeDeliveryMin === 0 ? "Free delivery on every order" : `Free delivery on orders from ${formatCedis(delivery.freeDeliveryMin)}`}
          </p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4">
        {featured.length > 0 && (
          <section className="pt-10" aria-labelledby="featured-title">
            <h2 id="featured-title" className="text-xl font-semibold tracking-tight">Featured</h2>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {featured.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} base={base} priority={i < 2} />)}
            </div>
          </section>
        )}

        <section id="products" className="scroll-mt-32 pt-10" aria-labelledby="products-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="products-title" className="text-xl font-semibold tracking-tight">
              {q ? <>Results for &ldquo;{q}&rdquo;</> : category ? category.name : "All products"}
              <span className="ml-2 text-sm font-normal text-muted">{total}</span>
            </h2>
            <nav aria-label="Sort products" className="flex gap-1 text-sm">
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <Link
                  key={k}
                  href={link({ sort: k === "new" ? null : k, page: null })}
                  scroll={false}
                  aria-current={sort === k ? "true" : undefined}
                  className={cn("rounded-full px-3 py-1.5", sort === k ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink")}
                >
                  {SORTS[k].label}
                </Link>
              ))}
            </nav>
          </div>

          {(categories?.length ?? 0) > 0 && (
            <nav aria-label="Categories" className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none]">
              <ul className="flex gap-2">
                <li>
                  <Link href={link({ category: null, page: null })} scroll={false} aria-current={!category ? "true" : undefined}
                    className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-sm", !category ? "border-(--store) bg-(--store) text-(--store-ink)" : "border-line-strong bg-surface hover:bg-paper")}>
                    All
                  </Link>
                </li>
                {categories!.map((c) => (
                  <li key={c.id}>
                    <Link href={link({ category: c.slug, page: null })} scroll={false} aria-current={category?.id === c.id ? "true" : undefined}
                      className={cn("inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border pl-1.5 pr-4 text-sm", category?.id === c.id ? "border-(--store) bg-(--store) text-(--store-ink)" : "border-line-strong bg-surface hover:bg-paper", !c.image_url && "pl-4")}>
                      {c.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                      )}
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {products.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
              <Search className="h-6 w-6 text-muted" aria-hidden="true" />
              <p className="mt-3 font-medium">{filtering ? "No products match" : "No products yet"}</p>
              <p className="mt-1 text-sm text-muted">{filtering ? "Try another word or category." : "Check back soon."}</p>
              {filtering && (
                <Link href={`${home}#products`} className="mt-5 text-sm font-medium underline">Show all products</Link>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p, i) => <ProductCard key={p.id} product={p} base={base} priority={filtering && i < 4} />)}
              </div>
              {products.length < total && page < 20 && (
                <div className="mt-10 flex justify-center">
                  <Link href={link({ page: String(page + 1) }).replace("#products", "")} scroll={false} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 text-sm font-medium hover:bg-paper">
                    Show more ({total - products.length} more)
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
