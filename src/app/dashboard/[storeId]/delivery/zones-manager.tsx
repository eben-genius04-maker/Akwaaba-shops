"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteZone, moveZone, saveZone, toggleZone } from "@/actions/delivery";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/fields";
import { initialFormState, type FormState } from "@/lib/forms";
import { amountInput } from "@/lib/delivery";
import { formatCedis } from "@/lib/format";

export type Zone = { id: string; name: string; description: string; fee: number; isActive: boolean };

const iconButton = "rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30";

export function ZonesManager({ storeId, zones }: { storeId: string; zones: Zone[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(zones.length === 0);

  return (
    <section className="rounded-2xl border border-line bg-surface" aria-labelledby="zones-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="zones-title" className="font-semibold">Delivery areas</h2>
          <p className="mt-0.5 text-sm text-muted">Customers pick one of these at checkout. The order here is the order they see.</p>
        </div>
        {!adding && zones.length > 0 && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add area
          </Button>
        )}
      </div>

      {zones.length > 0 && (
        <ul className="divide-y divide-line">
          {zones.map((z, i) =>
            editing === z.id ? (
              <li key={z.id} className="bg-paper/50 px-5 py-4 sm:px-6">
                <ZoneForm storeId={storeId} zone={z} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={z.id} className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5">
                <div className="flex flex-col">
                  <ActionForm action={moveZone} hidden={{ storeId, zoneId: z.id, direction: "up" }}>
                    <button className={iconButton} disabled={i === 0} aria-label={`Move ${z.name} up`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </ActionForm>
                  <ActionForm action={moveZone} hidden={{ storeId, zoneId: z.id, direction: "down" }}>
                    <button className={iconButton} disabled={i === zones.length - 1} aria-label={`Move ${z.name} down`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </ActionForm>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={z.isActive ? "font-medium" : "font-medium text-muted"}>{z.name}</span>
                    {!z.isActive && <Badge>Hidden</Badge>}
                  </p>
                  {z.description && <p className="truncate text-sm text-muted">{z.description}</p>}
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{z.fee === 0 ? "Free" : formatCedis(z.fee)}</span>
                <div className="flex shrink-0 items-center">
                  <button type="button" className={iconButton} onClick={() => { setEditing(z.id); setAdding(false); }} aria-label={`Edit ${z.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ActionForm action={toggleZone} hidden={{ storeId, zoneId: z.id, active: String(!z.isActive) }}>
                    <button className={iconButton} aria-label={z.isActive ? `Hide ${z.name} from checkout` : `Show ${z.name} at checkout`} title={z.isActive ? "Hide from checkout" : "Show at checkout"}>
                      {z.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={deleteZone}
                    hidden={{ storeId, zoneId: z.id }}
                    confirm={{
                      title: `Delete "${z.name}"?`,
                      body: "Customers won't be able to choose this area. Past orders aren't affected.",
                      confirmLabel: "Delete area",
                      danger: true,
                    }}
                  >
                    <button className={`${iconButton} hover:text-danger`} aria-label={`Delete ${z.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ActionForm>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {zones.length === 0 && !adding && (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <MapPinned className="h-6 w-6 text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted">No delivery areas yet.</p>
        </div>
      )}

      {adding && (
        <div className="border-t border-line px-5 py-5 first:border-t-0 sm:px-6">
          <p className="mb-4 text-sm font-medium">New area</p>
          <ZoneForm storeId={storeId} onCancel={zones.length > 0 ? () => setAdding(false) : undefined} />
        </div>
      )}
    </section>
  );
}

function ZoneForm({ storeId, zone, onDone, onCancel }: { storeId: string; zone?: Zone; onDone?: () => void; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveZone(prev, fd);
    if (result.message) {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    }
    if (result.ok) onDone?.();
    return result;
  }, initialFormState);

  const v = (k: "name" | "description" | "fee") =>
    state.values?.[k] ?? (zone ? (k === "fee" ? amountInput(zone.fee) : zone[k]) : "");
  const e = (k: string) => state.fieldErrors?.[k];
  const idp = zone ? `zone-${zone.id}` : "zone-new";

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="storeId" value={storeId} />
      {zone && <input type="hidden" name="zoneId" value={zone.id} />}
      {!zone && <input type="hidden" name="isActive" value="on" />}
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field id={`${idp}-name`} label="Area name" name="name" required maxLength={80} placeholder="e.g. Teshie / Nungua" defaultValue={v("name")} errors={e("name")} autoFocus={!!zone} />
        <Field id={`${idp}-fee`} label="Delivery fee" name="fee" required inputMode="decimal" prefix="GH₵" placeholder="20" defaultValue={v("fee")} errors={e("fee")} hint="0 = free" />
      </div>
      <Field
        id={`${idp}-description`}
        label="Places included (optional)"
        name="description"
        maxLength={300}
        placeholder="e.g. Lashibi, Sakumono, Community 18"
        defaultValue={v("description")}
        errors={e("description")}
        hint="Helps customers who aren't sure which area they're in."
      />
      {zone && (
        <Toggle
          name="isActive"
          label="Show at checkout"
          description="Hide an area for a while without deleting it."
          defaultChecked={state.values ? state.values.isActive === "on" : zone.isActive}
        />
      )}
      <div className="flex justify-end gap-2">
        {(zone || onCancel) && (
          <Button type="button" variant="secondary" onClick={zone ? onDone : onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {zone ? "Save area" : "Add area"}
        </Button>
      </div>
    </form>
  );
}
