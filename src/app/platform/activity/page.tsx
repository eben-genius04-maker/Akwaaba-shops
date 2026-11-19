import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

// Every approval, suspension and commission change, newest first
export default async function PlatformActivity() {
  const supabase = await createClient();
  const { data: log } = await supabase
    .from("platform_audit_log")
    .select("id, action, old_value, new_value, note, created_at, store_id, stores(name), profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-muted">A permanent record of admin changes: who did what, and when.</p>
      </div>
      {!log?.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted">No admin changes yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {log.map((l) => (
            <li key={l.id} className="px-5 py-3">
              <Link href={`/platform/stores/${l.store_id}`} className="font-medium hover:underline">{l.stores?.name ?? "Deleted store"}</Link>
              <span>: {l.action === "store_status" ? `${l.old_value} → ${l.new_value}` : `commission ${Number(l.old_value)}% → ${Number(l.new_value)}%`}</span>
              {l.note && <span className="text-ink/80"> · {l.note}</span>}
              <span className="block text-xs text-muted">{formatDateTime(l.created_at)} · {l.profiles?.full_name ?? l.profiles?.email ?? "System (automatic)"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
