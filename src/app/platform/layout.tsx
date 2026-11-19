import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { PlatformNav } from "@/components/platform/platform-nav";
import { signOut } from "@/actions/auth";

export const metadata: Metadata = { title: { template: "%s · Admin · Akwaaba Shops", default: "Admin · Akwaaba Shops" }, robots: { index: false } };

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const user = await requirePlatformAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending");

  return (
    <div className="adinkra-bg min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-3">
            <Logo href="/platform" />
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-paper">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Admin
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <ThemeToggle />
            <Link href="/dashboard" className="font-medium hover:underline">My stores</Link>
            <form action={signOut}><button className="text-muted hover:text-ink">Log out</button></form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <PlatformNav pending={count ?? 0} />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
