import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/layout";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategoryPage({ params }: PageProps<"/dashboard/[storeId]/categories/new">) {
  const { storeId } = await params;
  const { store } = await requireStoreAccess(storeId);
  if (store.role === "staff") notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader title="New category" back={{ href: `/dashboard/${storeId}/categories`, label: "Categories" }} />
      <CategoryForm storeId={storeId} initial={{ name: "", slug: "", description: "", isActive: true, imagePath: null, imageUrl: null }} />
    </div>
  );
}
