import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";
import { isShopperNext } from "@/lib/forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  return (
    <>
      <AuthHeading title="Welcome back">
        {isShopperNext(nextPath) ? "Log in to use your saved addresses and see your orders." : "Log in to manage your store."}
      </AuthHeading>
      {error === "link" && (
        <Alert tone="danger" title="That link didn't work" className="mb-6">
          It may have expired or already been used. Log in, or request a new link.
        </Alert>
      )}
      <LoginForm next={nextPath} />
      <p className="mt-8 text-center text-sm text-muted">
        New to Akwaaba Shops?{" "}
        <Link href={`/signup${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
