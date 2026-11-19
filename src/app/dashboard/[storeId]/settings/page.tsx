import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStoreAccess } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout";
import { pathFromPublicUrl } from "@/lib/storage";
import { storeUrl } from "@/lib/tenant";
import { formatGhanaPhone } from "@/lib/format";
import { socialHandle } from "@/lib/validations/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/dashboard/[storeId]/settings">) {
  const { storeId } = await params;
  const { store } = await requireStoreAccess(storeId);
  if (store.role !== "owner") notFound();

  const supabase = await createClient();
  const [{ data: s }, { data: pay }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("store_id", storeId).single(),
    supabase.from("store_payment_settings").select("paystack_subaccount_code, paystack_mode, paystack_status").eq("store_id", storeId).maybeSingle(),
  ]);
  if (!s) notFound();
  const socials = (s.social_links ?? {}) as Record<string, string | null>;

  return (
    <>
      <PageHeader title="Settings" description="How your store looks to customers, and how they can reach you." />
      {/* Paystack lives on the Payments page; point owners there from Settings too */}
      <Link href={`/dashboard/${storeId}/payments`} className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-brand/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><CreditCard className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Online payments (Paystack)</span>
          <span className="block text-sm text-muted">
            {pay?.paystack_subaccount_code
              ? pay.paystack_status === "split_broken"
                ? "Paused: open Payments to fix it."
                : `Connected (${pay.paystack_mode === "live" ? "live" : "test mode"}). Manage your keys on the Payments page.`
              : "Enter your Paystack Public and Secret keys to accept MoMo and card payments."}
          </span>
        </span>
        <span className="hidden text-sm font-medium text-brand sm:inline">{pay?.paystack_subaccount_code ? "Manage" : "Connect Paystack"}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>
      <SettingsForm
        storeId={storeId}
        storeAddress={storeUrl(store.slug).replace(/^https?:\/\//, "")}
        initial={{
          name: s.business_name,
          description: s.description ?? "",
          address: s.address ?? "",
          whatsappNumber: s.whatsapp_number ? formatGhanaPhone(s.whatsapp_number) : "",
          contactPhone: s.contact_phone ? formatGhanaPhone(s.contact_phone) : "",
          email: s.email ?? "",
          brandColor: s.brand_color ?? "#0b6e4f",
          heroTitle: s.hero_title ?? "",
          heroSubtitle: s.hero_subtitle ?? "",
          instagram: socialHandle(socials.instagram),
          facebook: socialHandle(socials.facebook),
          tiktok: socialHandle(socials.tiktok),
          x: socialHandle(socials.x),
        }}
        logo={{ path: pathFromPublicUrl(s.logo_url), url: s.logo_url }}
        hero={{ path: pathFromPublicUrl(s.hero_image_url), url: s.hero_image_url }}
      />
    </>
  );
}
