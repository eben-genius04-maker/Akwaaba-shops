"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { removeStoreImages, uploadStoreImage } from "@/lib/images";
import type { AssetFolder } from "@/lib/storage";
import { cn } from "@/lib/cn";

// One image (logo, banner, category picture). Uploads straight to storage and
// puts the file path in a hidden input that the form submits.
export function ImageField({
  name, label, hint, storeId, folder, initialPath, initialUrl, maxDimension, aspect = "square", onUploadingChange,
}: {
  name: string;
  label: string;
  hint?: string;
  storeId: string;
  folder: AssetFolder;
  initialPath: string | null;
  initialUrl: string | null;
  maxDimension: number;
  aspect?: "square" | "wide";
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const savedPath = initialPath ?? "";

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    onUploadingChange?.(true);
    try {
      const supabase = createClient();
      const uploaded = await uploadStoreImage(supabase, { storeId, folder, file, maxDimension });
      // A previous unsaved upload is no longer needed
      if (path && path !== savedPath) await removeStoreImages(supabase, [path]);
      setPath(uploaded.path);
      setUrl(uploaded.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      onUploadingChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  async function onRemove() {
    if (path && path !== savedPath) await removeStoreImages(createClient(), [path]);
    setPath("");
    setUrl("");
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{label}</p>
      <input type="hidden" name={name} value={path} />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-paper text-muted hover:border-brand hover:text-brand",
            aspect === "square" ? "h-24 w-24" : "h-24 w-40 sm:w-56",
          )}
          aria-label={url ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {busy ? (
            <Loader2 className="relative h-6 w-6 animate-spin text-brand" aria-hidden="true" />
          ) : (
            !url && <ImagePlus className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="font-medium text-brand hover:underline disabled:opacity-50">
              {busy ? "Uploading…" : url ? "Change" : "Upload"}
            </button>
            {url && !busy && (
              <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 font-medium text-danger hover:underline">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={`Upload ${label}`} onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  );
}
