import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

// "Data access layer": the ONLY place pages and actions learn who is signed in.
// Every check here is backed by the database security rules as well.

export type CurrentUser = { id: string; email: string; fullName: string | null; isPlatformAdmin: boolean };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_platform_admin")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  };
});

export async function requireUser(nextPath = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export type MyStore = {
  id: string;
  name: string;
  slug: string;
  status: Enums<"store_status">;
  statusReason: string | null;
  role: Enums<"member_role">;
};

export const getMyStores = cache(async (userId: string): Promise<MyStore[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_members")
    .select("role, store:stores(id, name, slug, status, status_reason, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load your stores: ${error.message}`);

  return (data ?? [])
    .filter((m) => m.store)
    .map((m) => ({
      id: m.store!.id,
      name: m.store!.name,
      slug: m.store!.slug,
      status: m.store!.status,
      statusReason: m.store!.status_reason,
      role: m.role,
    }));
});

// For /dashboard/[storeId]/...: the user must be a member of that store.
export async function requireStoreAccess(storeId: string) {
  const user = await requireUser(`/dashboard/${storeId}`);
  const stores = await getMyStores(user.id);
  const store = stores.find((s) => s.id === storeId);
  if (!store) notFound();
  return { user, store, stores };
}

// For Server Actions: returns the store if the user is a member with one of
// the given roles, otherwise null (the action then returns a friendly error).
export async function getStoreAccess(storeId: unknown, roles?: Array<Enums<"member_role">>) {
  if (typeof storeId !== "string" || !/^[0-9a-f-]{36}$/i.test(storeId)) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const stores = await getMyStores(user.id);
  const store = stores.find((s) => s.id === storeId);
  if (!store || (roles && !roles.includes(store.role))) return null;
  return { user, store };
}

// Platform admin pages: anyone else gets "not found" (we don't reveal the page exists)
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/platform");
  if (!user.isPlatformAdmin) notFound();
  return user;
}

export const NO_PERMISSION = "You don't have permission to do that. Ask the store owner.";
