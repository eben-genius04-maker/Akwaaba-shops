import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronRight, MessageCircle, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { coverImage, getPublicDeliveryInfo, getStoreBase, getStoreOrigin, getStorefront } from "@/lib/storefront";
import { formatCedis } from "@/lib/format";
import { Gallery } from "@/components/storefront/gallery";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import { whatsappLink } from "@/components/storefront/whatsapp";

const getProduct = cache(async (storeId: string, slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, description, price, stock_quantity, is_available, category_id, categories(name, slug, is_active), product_images(image_url, alt_text, sort_order, is_primary)")
    .eq("store_id", storeId)
    .eq("slug", slug.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/s/[store]/p/[product]">): Promise<Metadata> {
  const { store: storeSlug, product: slug } = await params;
  const store = await getStorefront(storeSlug);
  const product = store ? await getProduct(store.id, slug) : null;
  if (!store || !product) return { title: "Not found" };
  const image = coverImage(product.product_images);
  const description = product.description?.slice(0, 160) ?? `${formatCedis(Number(product.price))} at ${store.name}.`;
  return {
    title: { absolute: `${product.name} · ${store.name}` },
    description,
    openGraph: { title: `${product.name} · ${formatCedis(Number(product.price))}`, description, images: image ? [image] : undefined },
    robots: store.status === "active" ? undefined : { index: false },
  };
}

export default async function ProductPage({ params }: PageProps<"/s/[store]/p/[product]">) {
  const { store: storeSlug, product: slug } = await params;
  const store = await getStorefront(storeSlug);
  if (!store) notFound();
  const product = await getProduct(store.id, slug);
  if (!product) notFound();
  const [base, origin, delivery] = await Promise.all([getStoreBase(store.slug), getStoreOrigin(), getPublicDeliveryInfo(store.slug)]);
  const home = base || "/";

  const images = [...product.product_images]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .map((i) => ({ url: i.image_url, alt: i.alt_text }));
  const price = Number(product.price);
  const soldOut = !product.is_available || product.stock_quantity === 0;
  const category = product.categories?.is_active ? product.categories : null;

  // More from the same category (or the newest products)
  const supabase = await createClient();
  let related = supabase
    .from("products")
    .select("id, name, slug, price, stock_quantity, is_available, product_images(image_url, sort_order, is_primary)")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .neq("id", product.id);
  if (category && product.category_id) related = related.eq("category_id", product.category_id);
  const { data: relatedRows } = await related.order("created_at", { ascending: false }).limit(4);
  const more: CardProduct[] = (relatedRows ?? []).map((p) => ({
    id: p.id, slug: p.slug, name: p.name, price: Number(p.price), stock: p.stock_quantity, available: p.is_available, image: coverImage(p.product_images),
  }));

  const pageUrl = `${origin}${base}/p/${product.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-muted">
        <Link href={home} className="hover:text-ink">Shop</Link>
        {category && (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href={`${home}?category=${category.slug}#products`} className="hover:text-ink">{category.name}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <Gallery images={images} name={product.name} />

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCedis(price)}</p>
            <p className="mt-2 text-sm">
              {soldOut ? (
                <span className="font-medium text-danger">{product.is_available ? "Sold out" : "Not available right now"}</span>
              ) : product.stock_quantity <= 5 ? (
                <span className="font-medium text-warning">Only {product.stock_quantity} left</span>
              ) : (
                <span className="font-medium text-success">In stock</span>
              )}
            </p>
          </div>

          {!soldOut && (
            <AddToCart product={{ id: product.id, slug: product.slug, name: product.name, price, image: images[0]?.url ?? null, stock: product.stock_quantity }} />
          )}

          {store.whatsapp && (
            <a
              href={whatsappLink(store.whatsapp, `Hello ${store.name}, I'm interested in "${product.name}" (${formatCedis(price)}).\n${pageUrl}`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#177a43] px-5 text-sm font-medium text-[#177a43] hover:bg-[#177a43] hover:text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {soldOut ? "Ask when it's back on WhatsApp" : "Ask about this on WhatsApp"}
            </a>
          )}

          {delivery?.enabled && (
            <div className="flex gap-3 rounded-xl bg-surface p-4 text-sm ring-1 ring-line">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-(--store)" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">Delivered to your door</p>
                <p className="text-muted">
                  The delivery fee is shown at checkout, based on your location.
                  {delivery.freeDeliveryMin !== null && delivery.freeDeliveryMin > 0 && ` Free on orders from ${formatCedis(delivery.freeDeliveryMin)}.`}
                </p>
                {delivery.note && <p className="text-muted">{delivery.note}</p>}
              </div>
            </div>
          )}

          {product.description && (
            <section aria-labelledby="desc-title">
              <h2 id="desc-title" className="font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink/85">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-16" aria-labelledby="more-title">
          <h2 id="more-title" className="text-xl font-semibold tracking-tight">{category ? `More in ${category.name}` : "You may also like"}</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
            {more.map((p) => <ProductCard key={p.id} product={p} base={base} />)}
          </div>
        </section>
      )}
    </div>
  );
}
