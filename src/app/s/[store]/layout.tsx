import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { InstallButton } from "@/components/pwa/install-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { getStoreBase, getStorefront } from "@/lib/storefront";
import { readableOn } from "@/lib/color";
import { formatGhanaPhone } from "@/lib/format";
import { env } from "@/lib/env";
import { StoreProvider } from "@/components/storefront/store-context";
import { CartButton } from "@/components/storefront/cart-button";
import { SearchBox } from "@/components/storefront/search-box";
import { whatsappLink } from "@/components/storefront/whatsapp";
import { WhatsAppFab } from "@/components/storefront/whatsapp-fab";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X" };

// Makes the shop installable as its own app (Chrome "Install", iPhone "Add to Home Screen")
export async function generateMetadata({ params }: LayoutProps<"/s/[store]">): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  if (!store) return {};
  const base = await getStoreBase(store.slug);
  return {
    applicationName: store.name,
    manifest: `${base}/app-manifest`,
    icons: {
      icon: [{ url: `${base}/app-icon/192`, sizes: "192x192", type: "image/png" }],
      apple: [{ url: `${base}/app-icon/180`, sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: store.name, statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: LayoutProps<"/s/[store]">): Promise<Viewport> {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  return { themeColor: store?.brandColor ?? "#0b6e4f" };
}

export default async function StorefrontLayout({ params, children }: LayoutProps<"/s/[store]">) {
  const { store: slug } = await params;
  const store = await getStorefront(slug);
  if (!store) notFound();
  const base = await getStoreBase(store.slug);
  const home = base || "/";
  const socials = Object.entries(store.socials).filter(([k, v]) => SOCIAL_LABELS[k] && typeof v === "string" && v);

  const style = { "--store": store.brandColor, "--store-ink": readableOn(store.brandColor) } as CSSProperties;

  return (
    <StoreProvider store={{ slug: store.slug, base, name: store.name, whatsapp: store.whatsapp, active: store.status === "active" }}>
      <div style={style} className="flex min-h-dvh flex-col bg-paper">
        {store.status !== "active" && (
          <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-paper">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            {store.status === "suspended" ? "This store is suspended. Only your team can see it." : "Preview: only your team can see this until the store is approved."}
          </div>
        )}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="h-1 bg-(--store)" />
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-6">
            <Link href={home} className="flex min-w-0 items-center gap-2.5">
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--store) font-semibold text-(--store-ink)">
                  {store.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate font-semibold tracking-tight">{store.name}</span>
            </Link>
            <Suspense fallback={<div className="hidden flex-1 md:block" />}>
              <SearchBox className="hidden max-w-md flex-1 md:block" />
            </Suspense>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle className="hidden sm:inline-flex" />
              <a href={`${env.siteUrl}/account`} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-ink/5" aria-label="My orders and account">
                <UserRound className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">My orders</span>
              </a>
              <CartButton />
            </div>
          </div>
          <div className="px-4 pb-2.5 md:hidden">
            <Suspense fallback={<div className="h-10" />}>
              <SearchBox />
            </Suspense>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1">{children}</main>

        <footer className="adinkra-bg mt-16 border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
            <div>
              <p className="font-semibold">{store.name}</p>
              {store.description && <p className="mt-2 max-w-md text-sm text-muted">{store.description}</p>}
              {socials.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {socials.map(([k, v]) => (
                    <li key={k}>
                      <a href={v!} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-line-strong px-3 py-1 text-sm hover:bg-paper">
                        {SOCIAL_LABELS[k]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="space-y-2.5 text-sm">
              {store.whatsapp && (
                <li>
                  <a href={whatsappLink(store.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
                    <MessageCircle className="h-4 w-4 text-muted" aria-hidden="true" /> WhatsApp {formatGhanaPhone(store.whatsapp)}
                  </a>
                </li>
              )}
              {store.phone && (
                <li>
                  <a href={`tel:+${store.phone}`} className="inline-flex items-center gap-2 hover:underline">
                    <Phone className="h-4 w-4 text-muted" aria-hidden="true" /> {formatGhanaPhone(store.phone)}
                  </a>
                </li>
              )}
              {store.email && (
                <li>
                  <a href={`mailto:${store.email}`} className="inline-flex items-center gap-2 hover:underline">
                    <Mail className="h-4 w-4 text-muted" aria-hidden="true" /> {store.email}
                  </a>
                </li>
              )}
              {store.address && (
                <li className="flex items-start gap-2 text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {store.address}
                </li>
              )}
            </ul>
          </div>
          <div className="border-t border-line py-5 text-center text-xs text-muted">
            Powered by{" "}
            <a href={env.siteUrl} className="font-medium text-ink hover:underline">Akwaaba Shops</a>
            {" · "}
            <a href={`${env.siteUrl}/signup`} className="hover:underline">Open your own shop</a>
            <span className="mt-3 flex justify-center">
              <InstallButton label={`Install ${store.name} app`} className="rounded-full border border-line px-4 py-2 text-ink hover:bg-ink/5" />
            </span>
            <span className="mt-3 flex justify-center sm:hidden"><ThemeToggle withLabel /></span>
          </div>
        </footer>

        {store.whatsapp && <WhatsAppFab number={store.whatsapp} storeName={store.name} />}
      </div>
    </StoreProvider>
  );
}
