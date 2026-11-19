import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { requireUser } from "@/lib/auth/dal";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await requireUser("/reset-password");
  return (
    <>
      <AuthHeading title="Choose a new password">
        For <strong className="text-ink">{user.email}</strong>
      </AuthHeading>
      <ResetForm />
    </>
  );
}
