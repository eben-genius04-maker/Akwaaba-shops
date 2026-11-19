import { getStoreBase, getStorefront } from "@/lib/storefront";

// Each shop gets its own installable app: its name, its colour, its logo.
// The address has no file extension so it also works on the shop's own subdomain.
export async function GET(_req: Request, { params }: RouteContext<"/s/[store]/app-manifest">) {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  if (!store) return new Response("Not found", { status: 404 });
  const base = await getStoreBase(store.slug);
  const shortName = store.name.length > 12 ? store.name.slice(0, 12).trim() : store.name;

  const manifest = {
    id: `${base}/`,
    name: store.name,
    short_name: shortName,
    description: store.description ?? `Shop ${store.name} online`,
    start_url: `${base}/?source=app`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: store.brandColor,
    categories: ["shopping"],
    icons: [
      { src: `${base}/app-icon/192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon/maskable-512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "My cart", url: `${base}/cart` }],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
  });
}
