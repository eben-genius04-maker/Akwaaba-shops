import type { MetadataRoute } from "next";

// Makes Akwaaba Shops installable ("Install app" / "Add to Home screen").
// Store owners get the dashboard on their home screen like an app.
// Each shop has its OWN manifest too: see src/app/s/[store]/app-manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Akwaaba Shops",
    short_name: "Akwaaba",
    description: "Run your online shop: products, orders and deliveries across Ghana.",
    start_url: "/dashboard?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: "#0b6e4f",
    categories: ["business", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Orders", url: "/dashboard?go=orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My account", url: "/account", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
