import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { signOut } from "@/actions/auth";

// Simple page frame for screens outside a store (store picker, create store)
export function PlainShell({ children, email, logoHref = "/dashboard" }: { children: ReactNode; email: string; logoHref?: string }) {
  return (
    <div className="adinkra-bg flex min-h-dvh flex-col">
      <div className="kente-band h-1.5" />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo href={logoHref} />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{email}</span>
          <ThemeToggle />
          <form action={signOut}>
            <button className="font-medium text-ink/80 hover:text-ink" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-6 sm:px-8">{children}</main>
    </div>
  );
}
