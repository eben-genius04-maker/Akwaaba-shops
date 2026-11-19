import type { Metadata } from "next";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { signOut } from "@/actions/auth";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Join a store", robots: { index: false } };

const REASONS: Record<string, string> = {
  expired: "This invitation has expired. Ask the store owner to send a new one.",
  revoked: "This invitation was cancelled by the store owner.",
  already_accepted: "This invitation has already been used.",
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([supabase.rpc("get_invitation", { p_token: token }), getCurrentUser()]);
  const invite = data?.[0];
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="kente-band h-1.5" />
      <div className="px-5 pt-6 sm:px-8"><Logo /></div>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8">
          {!invite ? (
            <>
              <h1 className="text-xl font-semibold">Invitation not found</h1>
              <p className="mt-2 text-muted">Check that you opened the full link. If it still doesn&apos;t work, ask the store owner for a new invitation.</p>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Users className="h-6 w-6" aria-hidden="true" /></span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Join {invite.store_name}</h1>
              <p className="mt-2 text-muted">
                You&apos;ve been invited as <strong className="capitalize text-ink">{invite.role}</strong> for <strong className="text-ink">{invite.email}</strong>.
              </p>

              <div className="mt-6 space-y-3">
                {!invite.is_valid ? (
                  <Alert tone="warning">{REASONS[invite.reason ?? ""] ?? "This invitation can't be used."}</Alert>
                ) : !user ? (
                  <>
                    <ButtonLink href={`/signup?next=${next}&email=${encodeURIComponent(invite.email)}`} size="lg" className="w-full">Create an account to join</ButtonLink>
                    <ButtonLink href={`/login?next=${next}`} variant="secondary" size="lg" className="w-full">I already have an account</ButtonLink>
                    <p className="text-center text-xs text-muted">Use the email address {invite.email}.</p>
                  </>
                ) : user.email.toLowerCase() !== invite.email.toLowerCase() ? (
                  <>
                    <Alert tone="warning" title="Different account">
                      You&apos;re logged in as {user.email}, but this invitation is for {invite.email}. Log out and use the right account.
                    </Alert>
                    <form action={signOut}>
                      <button className="w-full rounded-lg border border-line-strong py-2.5 text-sm font-medium hover:bg-paper">Log out</button>
                    </form>
                  </>
                ) : (
                  <AcceptButton token={token} />
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
