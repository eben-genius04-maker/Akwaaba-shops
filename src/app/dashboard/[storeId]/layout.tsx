import { requireStoreAccess } from "@/lib/auth/dal";
import { Sidebar } from "@/components/dashboard/sidebar";
import { navForRole } from "@/components/dashboard/nav";
import { storePathUrl, storeUrl } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { OrderPulse } from "@/components/orders/order-pulse";

export default async function StoreDashboardLayout({ children, params }: LayoutProps<"/dashboard/[storeId]">) {
  const { storeId } = await params;
  const { user, store, stores } = await requireStoreAccess(storeId);
  const supabase = await createClient();
  const [{ count: pending }, { data: latest }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "pending"),
    supabase.from("orders").select("id").eq("store_id", store.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <div className="min-h-dvh">
      <Sidebar
        store={store}
        stores={stores}
        items={navForRole(store.role)}
        storefrontUrl={store.status === "active" ? storeUrl(store.slug) : storePathUrl(store.slug)}
        user={{ name: user.fullName ?? user.email.split("@")[0], email: user.email }}
        pendingOrders={pending ?? 0}
        isPlatformAdmin={user.isPlatformAdmin}
      />
      <OrderPulse storeId={store.id} initialPending={pending ?? 0} initialLatestId={latest?.id ?? null} />
      <div className="adinkra-bg min-h-dvh lg:pl-64 print:pl-0">
        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
