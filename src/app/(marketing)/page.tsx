import { Bike, MapPin, MessageCircle, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

const features = [
  {
    Icon: MapPin,
    title: "Delivery that knows Ghana",
    body: "Customers drop a GPS pin and add their digital address or directions. You set your own prices by zone or by distance.",
  },
  {
    Icon: Wallet,
    title: "MoMo, card or cash",
    body: "Customers choose: pay now with Mobile Money or card, or pay the rider on delivery. Online payments go straight to you.",
  },
  {
    Icon: Smartphone,
    title: "Built for the phone",
    body: "Your shop loads fast on any phone. Customers order in a few taps and track their order with one link.",
  },
  {
    Icon: MessageCircle,
    title: "WhatsApp stays close",
    body: "Every order has a chat button, so customers can still reach you on WhatsApp when they need to.",
  },
  {
    Icon: Bike,
    title: "Every order in one place",
    body: "Confirm, dispatch and mark delivered. Customers see each step on their tracking page.",
  },
  {
    Icon: ShieldCheck,
    title: "Your team, your rules",
    body: "Invite managers and staff. Each person sees only what their role allows.",
  },
];

const steps = [
  { n: "1", title: "Create your store", body: "Pick a name and your shop address, like kofishoes.akwaabashops.com." },
  { n: "2", title: "Add products & delivery prices", body: "Upload photos, set prices, and choose where you deliver." },
  { n: "3", title: "Share your link", body: "Post it on WhatsApp, Instagram and TikTok. Orders come to your dashboard." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="kente-band h-1.5" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Open your store
          </ButtonLink>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-16">
          <div className="space-y-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-3 py-1 text-xs font-medium text-warning">
              Made in Ghana, for Ghanaian businesses
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
              Your shop, online.
              <br />
              <span className="text-brand">Orders, delivery and MoMo</span> in one place.
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Open an online store in minutes. Customers order from their phone, choose where to deliver, and pay with
              Mobile Money or cash on delivery.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Open your store — it&apos;s free
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                See how it works
              </ButtonLink>
            </div>
            <p className="text-sm text-muted">No setup fees. Only 1% on online payments.</p>
          </div>

          {/* Phone mock: an order */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="kente-weave absolute -inset-4 -z-10 rotate-2 rounded-[2rem] opacity-90" />
            <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <p className="text-xs text-muted">Order #1024</p>
                  <p className="font-semibold">Ama Serwaa</p>
                </div>
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Paid · MoMo</span>
              </div>
              <ul className="space-y-3 py-4 text-sm">
                <li className="flex justify-between"><span>Classic White Sneakers × 1</span><span>GH₵350.00</span></li>
                <li className="flex justify-between"><span>Canvas Backpack × 1</span><span>GH₵260.00</span></li>
                <li className="flex justify-between text-muted"><span>Delivery · Teshie / Nungua</span><span>GH₵25.00</span></li>
              </ul>
              <div className="flex justify-between border-t border-line pt-4 font-semibold">
                <span>Total</span>
                <span>GH₵635.00</span>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-paper p-3 text-xs text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
                <span>GL-123-4567 · Blue gate opposite Total filling station</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                <span className="rounded-md bg-brand py-1.5 text-on-brand">Confirmed</span>
                <span className="rounded-md bg-brand py-1.5 text-on-brand">On the way</span>
                <span className="rounded-md bg-ink/5 py-1.5 text-muted">Delivered</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">Everything you need to sell online in Ghana</h2>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ Icon, title, body }) => (
                <div key={title} className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-3xl font-semibold tracking-tight">Open your store in three steps</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-xl border border-line bg-surface p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-semibold text-on-gold">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-[#1b1814] p-8 text-white ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-semibold">Ready to welcome your first customer?</p>
              <p className="mt-1 text-white/70">Free to start. Your store is reviewed and live within a day.</p>
            </div>
            <ButtonLink href="/signup" size="lg" className="bg-gold text-on-gold hover:bg-gold/90">
              Open your store
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Akwaaba Shops</p>
          <p>A product of LoneWolf Digital Technologies</p>
        </div>
      </footer>
    </div>
  );
}
