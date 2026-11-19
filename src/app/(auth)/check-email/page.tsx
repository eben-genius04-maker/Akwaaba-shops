import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";

  return (
    <div className="space-y-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <MailCheck className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-[15px] text-muted">
          We sent a confirmation link to {address ? <strong className="text-ink">{address}</strong> : "your email"}. Open it
          to activate your account. You can open it on any device.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-ink">Can&apos;t find it?</p>
        <p className="mt-1">Check your spam or promotions folder. Still nothing after a few minutes?</p>
        <div className="mt-3">
          <ResendForm email={address} />
        </div>
      </div>
    </div>
  );
}
