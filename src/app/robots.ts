import type { MetadataRoute } from "next";

// Search engines may list shops and products, but not private pages
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/platform", "/account", "/api/", "/auth/", "/invite/", "/track/", "/reset-password", "/*/cart", "/*/checkout", "/*/order/", "/cart", "/checkout", "/order/"],
    },
  };
}
