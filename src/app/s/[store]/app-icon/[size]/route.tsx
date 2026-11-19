import sharp from "sharp";
import { ImageResponse } from "next/og";
import { getStorefront } from "@/lib/storefront";
import { readableOn } from "@/lib/color";

export const runtime = "nodejs";

const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "180": { px: 180, maskable: true }, // iPhone home screen (no transparency)
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
};

const headers = { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" };

// The shop's app icon: its logo on its brand colour, or its first letter when there's no logo.
export async function GET(_req: Request, { params }: RouteContext<"/s/[store]/app-icon/[size]">) {
  const { store: slug, size } = await params;
  const spec = SIZES[size];
  if (!spec) return new Response("Not found", { status: 404 });
  const store = await getStorefront(slug);
  if (!store) return new Response("Not found", { status: 404 });
  const { px, maskable } = spec;

  if (store.logoUrl) {
    try {
      const res = await fetch(store.logoUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const inner = Math.round(px * (maskable ? 0.7 : 0.86));
        const logo = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        const round = maskable ? 0 : Math.round(px * 0.22);
        const bg = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><rect width="${px}" height="${px}" rx="${round}" fill="${maskable ? store.brandColor : "#ffffff"}"/></svg>`,
        );
        const png = await sharp(bg).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
        return new Response(new Uint8Array(png), { headers });
      }
    } catch {
      // fall through to the letter icon
    }
  }

  const letter = store.name.trim().slice(0, 1).toUpperCase() || "A";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: store.brandColor,
          color: readableOn(store.brandColor),
          fontSize: px * (maskable ? 0.42 : 0.56),
          fontWeight: 700,
          borderRadius: maskable ? 0 : px * 0.22,
        }}
      >
        {letter}
      </div>
    ),
    { width: px, height: px, headers: { "Cache-Control": headers["Cache-Control"] } },
  );
}
