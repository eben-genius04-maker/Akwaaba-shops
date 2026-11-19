import { env } from "@/lib/env";

// All store images live in one public bucket, under the store's ID:
//   {storeId}/products/{file}  ·  {storeId}/categories/{file}  ·  {storeId}/branding/{file}
export const BUCKET = "store-assets";
export type AssetFolder = "products" | "categories" | "branding";

export function publicUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Product photos are uploaded in two sizes: full and a small "-thumb" for lists.
export function thumbPath(path: string): string {
  return path.replace(/(\.[a-z0-9]+)$/i, "-thumb$1");
}

export function thumbUrl(url: string): string {
  return url.replace(/(\.[a-z0-9]+)$/i, "-thumb$1");
}

// Turns a public URL back into a storage path, only if it's one of ours.
export function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${env.supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

const SAFE_FILE = /^[A-Za-z0-9._-]{1,100}$/;

// True when `path` is a file inside this store's folder, e.g. "{storeId}/products/abc.webp"
export function isStorePath(path: unknown, storeId: string, folder: AssetFolder): path is string {
  if (typeof path !== "string") return false;
  const [id, f, file, ...rest] = path.split("/");
  return id === storeId && f === folder && !!file && rest.length === 0 && SAFE_FILE.test(file);
}
