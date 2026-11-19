import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (large screens) */}
      <aside className="kente-weave relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b1814]/80 via-[#1b1814]/55 to-[#0b6e4f]/40" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo light />
          <div className="max-w-md space-y-5">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">Akwaaba — you are welcome</p>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              Your shop, open to every phone in Ghana.
            </h2>
            <p className="text-white/80">
              Take orders with delivery addresses, get paid with MoMo or on delivery, and track every order from one
              dashboard.
            </p>
          </div>
          <div className="space-y-2 text-xs text-white/60">
            <p>
              The patterns are Adinkra symbols of the Akan: <span className="text-white/80">Gye Nyame</span> (except for God),{" "}
              <span className="text-white/80">Sankofa</span> (learn from the past), <span className="text-white/80">Dwennimmen</span> (humility and
              strength), <span className="text-white/80">Akoma</span> (patience) and more.
            </p>
            <p>© {new Date().getFullYear()} Akwaaba Shops · LoneWolf Digital Technologies</p>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <main id="main" tabIndex={-1} className="adinkra-bg flex flex-col">
        <div className="kente-band h-1.5 lg:hidden" />
        <div className="flex items-center justify-between px-5 pt-6">
          <span className="lg:invisible"><Logo /></span>
          <ThemeToggle withLabel />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
