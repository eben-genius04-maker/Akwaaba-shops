"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { removeStoreImages, uploadStoreImage } from "@/lib/images";
import { thumbUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";

const MAX = 8;

type Photo = { key: string; path: string; url: string; saved: boolean; uploading: boolean; preview?: string };

// Up to 8 product photos. The first one is the cover. Photos upload as soon as
// they're picked; the list (order + cover) is saved when the form is saved.
export function PhotoManager({ storeId, initial, onBusyChange }: {
  storeId: string;
  initial: { path: string; url: string }[];
  onBusyChange: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>(() => initial.map((p) => ({ ...p, key: p.path, saved: true, uploading: false })));
  const input = useRef<HTMLInputElement>(null);
  const busy = photos.some((p) => p.uploading);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast.info(`You can add up to ${MAX} photos per product.`);

    const pending: Photo[] = picked.map((f) => ({ key: crypto.randomUUID(), path: "", url: "", saved: false, uploading: true, preview: URL.createObjectURL(f) }));
    setPhotos((list) => [...list, ...pending]);

    const supabase = createClient();
    // One at a time: kinder to slow mobile connections
    for (let i = 0; i < picked.length; i++) {
      const key = pending[i].key;
      try {
        const up = await uploadStoreImage(supabase, { storeId, folder: "products", file: picked[i], maxDimension: 1600, thumbnail: 480 });
        setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...up, uploading: false } : p)));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed.");
        setPhotos((list) => list.filter((p) => p.key !== key));
      } finally {
        URL.revokeObjectURL(pending[i].preview!);
      }
    }
    if (input.current) input.current.value = "";
  }

  function move(index: number, to: number) {
    setPhotos((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function remove(photo: Photo) {
    setPhotos((list) => list.filter((p) => p.key !== photo.key));
    // Unsaved uploads are deleted now; saved ones are deleted when the product is saved
    if (!photo.saved && photo.path) await removeStoreImages(createClient(), [photo.path], true);
  }

  const ready = photos.filter((p) => !p.uploading && p.path);

  return (
    <div className="space-y-3">
      <input type="hidden" name="images" value={JSON.stringify(ready.map((p) => ({ path: p.path })))} />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.key} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview ?? (p.saved ? thumbUrl(p.url) : p.url)} alt="" className={cn("h-full w-full object-cover", p.uploading && "opacity-50")} />
            {p.uploading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" aria-label="Uploading" />
              </span>
            ) : (
              <>
                {i === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium text-paper">Cover</span>
                ) : (
                  <button type="button" onClick={() => move(i, 0)} className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-surface/90 px-1.5 py-0.5 text-[11px] font-medium shadow-sm hover:bg-surface" aria-label={`Make photo ${i + 1} the cover`}>
                    <Star className="h-3 w-3" aria-hidden="true" /> Cover
                  </button>
                )}
                <button type="button" onClick={() => remove(p)} className="absolute right-1.5 top-1.5 rounded-full bg-surface/90 p-1 shadow-sm hover:bg-danger hover:text-on-danger" aria-label={`Remove photo ${i + 1}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-full bg-surface/90 p-1 shadow-sm disabled:invisible" aria-label={`Move photo ${i + 1} left`}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1} className="rounded-full bg-surface/90 p-1 shadow-sm disabled:invisible" aria-label={`Move photo ${i + 1} right`}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {photos.length < MAX && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong text-sm font-medium text-muted hover:border-brand hover:text-brand"
            >
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
              Add photos
            </button>
          </li>
        )}
      </ul>
      <p className="text-xs text-muted">
        Up to {MAX} photos. The first is the cover. Photos are resized automatically to load fast on phones.
      </p>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => addFiles(e.target.files)} aria-label="Add product photos" />
    </div>
  );
}
