import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemedToaster } from "@/components/theme/themed-toaster";
import { themeScript } from "@/components/theme/theme";
import { PwaSetup } from "@/components/pwa/pwa-setup";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Akwaaba Shops — Your shop, online", template: "%s · Akwaaba Shops" },
  description:
    "Open an online shop in minutes. Customers order from their phone, pay with MoMo or on delivery, and you deliver across Ghana.",
  applicationName: "Akwaaba Shops",
  // app/manifest.ts adds the manifest link; shops override it with their own
  icons: {
    icon: [{ url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Akwaaba Shops", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b6e4f" },
    { media: "(prefers-color-scheme: dark)", color: "#12100d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GH" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Sets light/dark before the page paints */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        {children}
        <ThemedToaster />
        <PwaSetup />
      </body>
    </html>
  );
}
