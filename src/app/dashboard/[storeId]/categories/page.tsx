import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, FolderTree, Plus } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionForm, FlashToast } from "@/components/ui/action-form";
import { moveCategory } from "@/actions/catalogue";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({ params, searchParams }: PageProps<"/dashboard/[storeId]/categories">) {
  const { storeId } = await params;
  const { saved, deleted } = await searchParams;
  const { store } = await requireStoreAccess(storeId);
  if (store.role === "staff") notFound();

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, is_active, image_url, products(count)")
    .eq("store_id", storeId)
    .order("sort_order")
    .order("name");

  const list = categories ?? [];
  const flash = typeof saved === "string" ? `"${saved}" saved.` : typeof deleted === "string" ? `"${deleted}" deleted.` : undefined;

  return (
    <>
      <FlashToast message={flash} />
      <PageHeader
        title="Categories"
        description="Group products so customers find them quickly. The order here is the order in your store."
        actions={
          <ButtonLink href={`/dashboard/${storeId}/categories/new`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> New category
          </ButtonLink>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-6 w-6" aria-hidden="true" />}
          title="No categories yet"
          action={<ButtonLink href={`/dashboard/${storeId}/categories/new`}>Create your first category</ButtonLink>}
        >
          For example: Sneakers, Bags, Watches. Categories are optional, but help when you have many products.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((c, i) => {
            const count = (c.products as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex flex-col">
                  <ActionForm action={moveCategory} hidden={{ storeId, categoryId: c.id, direction: "up" }}>
                    <button className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label={`Move ${c.name} up`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </ActionForm>
                  <ActionForm action={moveCategory} hidden={{ storeId, categoryId: c.id, direction: "down" }}>
                    <button className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" disabled={i === list.length - 1} aria-label={`Move ${c.name} down`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </ActionForm>
                </div>
                <Link href={`/dashboard/${storeId}/categories/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 hover:opacity-80">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : <FolderTree className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block text-sm text-muted">{count} {count === 1 ? "product" : "products"}</span>
                  </span>
                </Link>
                {!c.is_active && <Badge>Hidden</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
