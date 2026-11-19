import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, Package, Plus, Search, Star } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionForm, FlashToast } from "@/components/ui/action-form";
import { inputClass } from "@/components/ui/field";
import { toggleProductActive } from "@/actions/catalogue";
import { formatCedis } from "@/lib/format";
import { thumbUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 24;
const STATUSES = { all: "All products", active: "Visible", hidden: "Hidden", out: "Out of stock", low: "Low stock (3 or less)", featured: "Featured" } as const;

export default async function ProductsPage({ params, searchParams }: PageProps<"/dashboard/[storeId]/products">) {
  const { storeId } = await params;
  const sp = await searchParams;
  await requireStoreAccess(storeId);

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const status = (typeof sp.status === "string" && sp.status in STATUSES ? sp.status : "all") as keyof typeof STATUSES;
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, price, stock_quantity, is_active, is_available, is_featured, category:categories(name), product_images(image_url, sort_order)", { count: "exact" })
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (category === "none") query = query.is("category_id", null);
  else if (/^[0-9a-f-]{36}$/i.test(category)) query = query.eq("category_id", category);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "hidden") query = query.eq("is_active", false);
  if (status === "out") query = query.eq("stock_quantity", 0);
  if (status === "low") query = query.gt("stock_quantity", 0).lte("stock_quantity", 3);
  if (status === "featured") query = query.eq("is_featured", true);

  const [{ data: products, count }, { data: categories }, { count: total }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").eq("store_id", storeId).order("sort_order").order("name"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
  ]);

  const list = products ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filtered = !!q || !!category || status !== "all";
  const flash = typeof sp.saved === "string" ? `"${sp.saved}" saved.` : typeof sp.deleted === "string" ? `"${sp.deleted}" deleted.` : undefined;
  const pageHref = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (category) u.set("category", category);
    if (status !== "all") u.set("status", status);
    if (n > 1) u.set("page", String(n));
    const s = u.toString();
    return `/dashboard/${storeId}/products${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <FlashToast message={flash} />
      <PageHeader
        title="Products"
        description={total ? `${total} ${total === 1 ? "product" : "products"} in your store` : undefined}
        actions={
          <ButtonLink href={`/dashboard/${storeId}/products/new`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add product
          </ButtonLink>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
          title="Add your first product"
          action={<ButtonLink href={`/dashboard/${storeId}/products/new`}>Add product</ButtonLink>}
        >
          Take clear photos in good light, add a price and how many you have. It takes about a minute.
        </EmptyState>
      ) : (
        <>
          {/* Filters (a normal GET form: works without JavaScript) */}
          <form className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_180px_auto]" role="search">
            <label className="relative">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input name="q" defaultValue={q} placeholder="Search by name" className={cn(inputClass, "pl-9")} />
            </label>
            <label>
              <span className="sr-only">Category</span>
              <select name="category" defaultValue={category} className={inputClass}>
                <option value="">All categories</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="none">No category</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select name="status" defaultValue={status} className={inputClass}>
                {Object.entries(STATUSES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button className={buttonClass("secondary", "md", "h-11 flex-1")}>Filter</button>
              {filtered && <Link href={`/dashboard/${storeId}/products`} className={buttonClass("ghost", "md", "h-11")}>Clear</Link>}
            </div>
          </form>

          {list.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface px-6 py-12 text-center text-muted">No products match your filters.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {list.map((p) => {
                const img = p.product_images[0]?.image_url;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
                    <Link href={`/dashboard/${storeId}/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper text-muted", !p.is_active && "opacity-50")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={thumbUrl(img)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Package className="h-5 w-5" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{p.name}</span>
                          {p.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" aria-label="Featured" />}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                          <span className="font-medium text-ink">{formatCedis(Number(p.price))}</span>
                          {p.category?.name && <span>· {p.category.name}</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {!p.is_active && <Badge>Hidden</Badge>}
                          {p.stock_quantity === 0 ? (
                            <Badge tone="danger">Out of stock</Badge>
                          ) : p.stock_quantity <= 3 ? (
                            <Badge tone="warning">{p.stock_quantity} left</Badge>
                          ) : (
                            <span className="text-xs text-muted">{p.stock_quantity} in stock</span>
                          )}
                          {!p.is_available && <Badge tone="warning">Orders paused</Badge>}
                        </span>
                      </span>
                    </Link>
                    <ActionForm action={toggleProductActive} hidden={{ storeId, productId: p.id, active: String(!p.is_active) }}>
                      <button
                        className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink"
                        aria-label={p.is_active ? `Hide ${p.name} from customers` : `Show ${p.name} to customers`}
                        title={p.is_active ? "Hide from store" : "Show in store"}
                      >
                        {p.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          )}

          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pages">
              {page > 1 ? <Link href={pageHref(page - 1)} className={buttonClass("secondary", "sm")}>Previous</Link> : <span />}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className={buttonClass("secondary", "sm")}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
