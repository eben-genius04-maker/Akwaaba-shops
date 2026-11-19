import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { env } from "@/lib/env";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 max-w-md text-muted">
          The page or store you&apos;re looking for doesn&apos;t exist, isn&apos;t open yet, or you don&apos;t have access to it.
        </p>
      </div>
      {/* Full address: on a store subdomain, "/" would point back at the missing store */}
      <ButtonLink href={env.siteUrl} variant="secondary">
        Go to Akwaaba Shops
      </ButtonLink>
    </main>
  );
}
