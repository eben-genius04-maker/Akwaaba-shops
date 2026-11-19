"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BUCKET, publicUrl, thumbPath, type AssetFolder } from "@/lib/storage";

// Photos are resized and compressed IN THE BROWSER before upload:
// a 6 MB phone photo becomes ~150 KB, which saves customers' mobile data.

const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  // Older browsers without WebP encoding
  const jpeg = await toBlob("image/jpeg");
  if (jpeg) return jpeg;
  throw new Error("Your browser couldn't process this photo. Please try another browser.");
}

export async function resizeImage(file: File, maxDimension: number, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a photo (JPG, PNG or WebP).");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("That photo is too large (over 25 MB). Please choose a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo format isn't supported here. Please use JPG or PNG.");
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this photo.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background (JPEG fallback)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return encode(canvas, quality);
}

export type UploadedImage = { path: string; url: string };

// Resizes and uploads one photo. With `thumbnail`, also uploads a small copy for lists.
export async function uploadStoreImage(
  supabase: SupabaseClient<Database>,
  opts: { storeId: string; folder: AssetFolder; file: File; maxDimension: number; thumbnail?: number },
): Promise<UploadedImage> {
  const main = await resizeImage(opts.file, opts.maxDimension);
  const ext = main.type === "image/webp" ? "webp" : "jpg";
  const path = `${opts.storeId}/${opts.folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, main, { contentType: main.type, cacheControl: "31536000" });
  if (error) throw new Error(uploadErrorMessage(error.message));

  if (opts.thumbnail) {
    const thumb = await resizeImage(opts.file, opts.thumbnail, 0.75);
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath(path), thumb, { contentType: thumb.type, cacheControl: "31536000" });
    if (thumbError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(uploadErrorMessage(thumbError.message));
    }
  }
  return { path, url: publicUrl(path) };
}

export async function removeStoreImages(supabase: SupabaseClient<Database>, paths: string[], withThumbs = false) {
  const all = withThumbs ? paths.flatMap((p) => [p, thumbPath(p)]) : paths;
  if (all.length) await supabase.storage.from(BUCKET).remove(all);
}

function uploadErrorMessage(message: string): string {
  if (/row-level security|unauthori/i.test(message)) return "You don't have permission to upload photos for this store.";
  if (/exceeded|too large/i.test(message)) return "That photo is still too large after compressing. Please choose a smaller one.";
  if (/mime/i.test(message)) return "That file type isn't allowed. Please use JPG, PNG or WebP.";
  return "Upload failed. Check your internet connection and try again.";
}
