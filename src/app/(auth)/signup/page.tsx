import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignupForm } from "./signup-form";
import { isShopperNext } from "@/lib/forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, email } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  return (
    <>
      {isShopperNext(nextPath) ? (
        <AuthHeading title="Create your account">One account for every shop on Akwaaba Shops: faster checkout and all your orders in one place.</AuthHeading>
      ) : (
        <AuthHeading title="Open your store">Create your free account. It takes about a minute.</AuthHeading>
      )}
      <SignupForm next={nextPath} email={typeof email === "string" ? email : ""} />
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
