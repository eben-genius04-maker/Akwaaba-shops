import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { NAV_ITEMS } from "@/components/dashboard/nav";
import { ButtonLink } from "@/components/ui/button";

// Placeholder for dashboard sections built in later phases.
// A real page at e.g. app/dashboard/[storeId]/products/page.tsx replaces this automatically.

export async function generateMetadata({ params }: PageProps<"/dashboard/[storeId]/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: NAV_ITEMS.find((i) => i.section === section)?.label ?? "Not found" };
}

export default async function ComingSoonSection({ params }: PageProps<"/dashboard/[storeId]/[section]">) {
  const { storeId, section } = await params;
  const item = NAV_ITEMS.find((i) => i.section === section && i.section !== "");
  if (!item) notFound();

  const { store } = await requireStoreAccess(storeId);
  if (!item.roles.includes(store.role)) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{item.label}</h1>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line-strong bg-surface p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-warning">
          <Hammer className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Coming in phase {item.phase}</p>
          <p className="mt-1 max-w-lg text-sm text-muted">{item.description}</p>
        </div>
        <ButtonLink href={`/dashboard/${storeId}`} variant="secondary" size="sm">
          Back to overview
        </ButtonLink>
      </div>
    </div>
  );
}
