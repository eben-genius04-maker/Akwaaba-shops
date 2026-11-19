import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui/layout";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { changeMemberRole, removeMember, revokeInvitation } from "@/actions/staff";
import { formatGhanaPhone } from "@/lib/format";
import { env } from "@/lib/env";
import { InviteForm } from "./invite-form";
import { RoleSelect } from "./role-select";

export const metadata: Metadata = { title: "Staff" };

const ROLE_HELP = [
  { role: "Owner", text: "Everything, including settings, payments and staff." },
  { role: "Manager", text: "Products, categories, orders and delivery prices." },
  { role: "Staff", text: "Add and edit products, and process orders." },
];

// Marks invitations past their expiry date (runs on the server for each request)
function markExpired<T extends { expires_at: string }>(list: T[] | null) {
  const now = Date.now();
  return (list ?? []).map((i) => ({ ...i, expired: new Date(i.expires_at).getTime() < now }));
}

export default async function StaffPage({ params }: PageProps<"/dashboard/[storeId]/staff">) {
  const { storeId } = await params;
  const { user, store } = await requireStoreAccess(storeId);
  if (store.role !== "owner") notFound();

  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("store_members").select("user_id, role, created_at, profile:profiles(full_name, email, phone)").eq("store_id", storeId).order("created_at"),
    supabase.from("store_invitations").select("id, email, role, token, expires_at, created_at").eq("store_id", storeId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  const ownerCount = (members ?? []).filter((m) => m.role === "owner").length;
  const pending = markExpired(invites);

  return (
    <>
      <PageHeader title="Staff" description="Invite people to help run your store. Each person logs in with their own account." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section title="Invite someone">
            <InviteForm storeId={storeId} storeName={store.name} />
          </Section>

          <Section title={`Team (${members?.length ?? 0})`}>
            <ul className="-my-2 divide-y divide-line">
              {(members ?? []).map((m) => {
                const isMe = m.user_id === user.id;
                const lastOwner = m.role === "owner" && ownerCount === 1;
                const name = m.profile?.full_name || m.profile?.email || "Team member";
                return (
                  <li key={m.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name} {isMe && <span className="font-normal text-muted">(you)</span>}</p>
                        <p className="truncate text-sm text-muted">
                          {m.profile?.email}
                          {m.profile?.phone && ` · ${formatGhanaPhone(m.profile.phone)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-13 sm:pl-0">
                      <RoleSelect storeId={storeId} userId={m.user_id} role={m.role} disabled={lastOwner} name={name} action={changeMemberRole} />
                      {!lastOwner && (
                        <ActionForm
                          action={removeMember}
                          hidden={{ storeId, userId: m.user_id }}
                          confirm={{
                            title: isMe ? "Leave this store?" : `Remove ${name}?`,
                            body: isMe ? "You'll lose access to this store's dashboard." : "They'll lose access to this store straight away.",
                            confirmLabel: isMe ? "Leave store" : "Remove",
                            danger: true,
                          }}
                        >
                          <button className="rounded-lg px-2.5 py-2 text-sm font-medium text-danger hover:bg-danger-soft">{isMe ? "Leave" : "Remove"}</button>
                        </ActionForm>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {ownerCount === 1 && <p className="text-xs text-muted">Every store needs at least one owner, so the last owner can&apos;t be removed or changed.</p>}
          </Section>

          {pending.length > 0 && (
            <Section title="Pending invitations">
              <ul className="-my-2 divide-y divide-line">
                {pending.map((inv) => {
                  const expired = inv.expired;
                  return (
                    <li key={inv.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{inv.email}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-sm capitalize text-muted">
                          {inv.role}
                          {expired ? <Badge tone="danger">Expired</Badge> : (
                            <span className="inline-flex items-center gap-1 normal-case"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> expires {new Date(inv.expires_at).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!expired && <CopyButton text={`${env.siteUrl}/invite/${inv.token}`} label="Copy link" />}
                        <ActionForm action={revokeInvitation} hidden={{ storeId, invitationId: inv.id }}>
                          <button className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">{expired ? "Remove" : "Cancel"}</button>
                        </ActionForm>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>

        <Section title="Roles" className="h-fit">
          <dl className="space-y-4 text-sm">
            {ROLE_HELP.map((r) => (
              <div key={r.role}>
                <dt className="font-medium">{r.role}</dt>
                <dd className="text-muted">{r.text}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </>
  );
}
