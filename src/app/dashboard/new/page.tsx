import type { Metadata } from "next";
import { getMyStores, requireUser } from "@/lib/auth/dal";
import { PlainShell } from "@/components/dashboard/plain-shell";
import { env } from "@/lib/env";
import { CreateStoreForm } from "./create-store-form";

export const metadata: Metadata = { title: "Create your store" };

export default async function NewStorePage() {
  const user = await requireUser("/dashboard/new");
  const stores = await getMyStores(user.id);
  const first = stores.length === 0;

  return (
    <PlainShell email={user.email}>
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-medium text-brand">{first ? `Akwaaba${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}!` : "New store"}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{first ? "Let's create your store" : "Create another store"}</h1>
        <p className="mt-2 text-muted">You can change the name later. The store address is permanent, so choose carefully.</p>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <CreateStoreForm rootDomain={env.rootDomain} />
        </div>
      </div>
    </PlainShell>
  );
}
