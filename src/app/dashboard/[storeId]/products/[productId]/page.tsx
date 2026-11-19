import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui/layout";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/actions/catalogue";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/dashboard/[storeId]/products/[productId]">) {
  const { storeId, productId } = await params;
  const { photos } = await searchParams;
  const { store } = await requireStoreAccess(storeId);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();

  const supabase = await createClient();
  const [{ data: p }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_images(storage_path, image_url, sort_order)")
      .eq("id", productId)
      .eq("store_id", storeId)
      .order("sort_order", { referencedTable: "product_images" })
      .maybeSingle(),
    supabase.from("categories").select("id, name").eq("store_id", storeId).order("sort_order").order("name"),
  ]);
  if (!p) notFound();

  const canDelete = store.role === "owner" || store.role === "manager";

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={p.name} back={{ href: `/dashboard/${storeId}/products`, label: "Products" }} />
        {photos === "failed" && (
          <Alert tone="warning" className="mb-6" title="Product saved, but the photos weren't">
            Please add the photos again and save.
          </Alert>
        )}
        <ProductForm
          storeId={storeId}
          categories={categories ?? []}
          initial={{
            id: p.id, name: p.name, slug: p.slug, description: p.description ?? "", price: String(p.price),
            categoryId: p.category_id ?? "", stockQuantity: String(p.stock_quantity), deliverySize: p.delivery_size,
            isActive: p.is_active, isAvailable: p.is_available, isFeatured: p.is_featured,
            images: p.product_images.filter((i) => i.storage_path).map((i) => ({ path: i.storage_path!, url: i.image_url })),
          }}
        />
      </div>
      {canDelete && (
        <Section title="Delete product">
          <p className="text-sm text-muted">Past orders keep their details. To stop selling it for now, turn off &quot;Show in store&quot; instead.</p>
          <ActionForm
            action={deleteProduct}
            hidden={{ storeId, productId }}
            confirm={{ title: `Delete "${p.name}"?`, body: "This deletes the product and its photos. It can't be undone.", confirmLabel: "Delete product", danger: true }}
          >
            <Button variant="danger" size="sm">Delete product</Button>
          </ActionForm>
        </Section>
      )}
    </div>
  );
}
