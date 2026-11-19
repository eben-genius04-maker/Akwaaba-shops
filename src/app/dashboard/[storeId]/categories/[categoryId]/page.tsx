import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui/layout";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "@/actions/catalogue";
import { pathFromPublicUrl } from "@/lib/storage";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: PageProps<"/dashboard/[storeId]/categories/[categoryId]">) {
  const { storeId, categoryId } = await params;
  const { store } = await requireStoreAccess(storeId);
  if (store.role === "staff" || !/^[0-9a-f-]{36}$/i.test(categoryId)) notFound();

  const supabase = await createClient();
  const { data: c } = await supabase.from("categories").select("*, products(count)").eq("id", categoryId).eq("store_id", storeId).maybeSingle();
  if (!c) notFound();
  const count = (c.products as unknown as { count: number }[])?.[0]?.count ?? 0;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <PageHeader title={c.name} back={{ href: `/dashboard/${storeId}/categories`, label: "Categories" }} />
        <CategoryForm
          storeId={storeId}
          initial={{ id: c.id, name: c.name, slug: c.slug, description: c.description ?? "", isActive: c.is_active, imagePath: pathFromPublicUrl(c.image_url), imageUrl: c.image_url }}
        />
      </div>
      <Section title="Delete category">
        <p className="text-sm text-muted">
          {count > 0 ? `The ${count} ${count === 1 ? "product" : "products"} in this category will stay in your store, just without a category.` : "This category has no products."}
        </p>
        <ActionForm
          action={deleteCategory}
          hidden={{ storeId, categoryId }}
          confirm={{ title: `Delete "${c.name}"?`, body: "This can't be undone. Products are not deleted.", confirmLabel: "Delete category", danger: true }}
        >
          <Button variant="danger" size="sm">Delete category</Button>
        </ActionForm>
      </Section>
    </div>
  );
}
