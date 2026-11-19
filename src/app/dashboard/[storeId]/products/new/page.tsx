import type { Metadata } from "next";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ params }: PageProps<"/dashboard/[storeId]/products/new">) {
  const { storeId } = await params;
  await requireStoreAccess(storeId);
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").eq("store_id", storeId).order("sort_order").order("name");

  return (
    <>
      <PageHeader title="Add product" back={{ href: `/dashboard/${storeId}/products`, label: "Products" }} />
      <ProductForm
        storeId={storeId}
        categories={categories ?? []}
        initial={{ name: "", slug: "", description: "", price: "", categoryId: "", stockQuantity: "", deliverySize: "small", isActive: true, isAvailable: true, isFeatured: false, images: [] }}
      />
    </>
  );
}
