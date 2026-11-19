import { z } from "zod";
import { normalizeGhanaPhone } from "@/lib/format";

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long (max ${max} characters).`).transform((v) => v || null);

const optionalPhone = (label: string) =>
  z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeGhanaPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: `Enter a valid Ghana ${label}, e.g. 024 123 4567.` });
      return z.NEVER;
    }
    return n;
  });

// Accepts "@kofishoes", "kofishoes" or a full link; stores a full link.
const social = (base: string, label: string) =>
  z.string().trim().max(200).transform((v, ctx) => {
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) {
      try {
        return new URL(v).toString();
      } catch {
        ctx.addIssue({ code: "custom", message: `Enter a valid ${label} link or username.` });
        return z.NEVER;
      }
    }
    const handle = v.replace(/^@/, "");
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) {
      ctx.addIssue({ code: "custom", message: `Enter a valid ${label} username.` });
      return z.NEVER;
    }
    return `${base}${handle}`;
  });

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(80, "Store name is too long."),
  description: optionalText(2000, "Description"),
  address: optionalText(300, "Address"),
  whatsappNumber: optionalPhone("WhatsApp number"),
  contactPhone: optionalPhone("phone number"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!z.email().safeParse(v).success) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
        return z.NEVER;
      }
      return v;
    }),
  brandColor: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Choose a colour." });
        return z.NEVER;
      }
      return v.toLowerCase();
    }),
  heroTitle: optionalText(120, "Banner headline"),
  heroSubtitle: optionalText(300, "Banner text"),
  instagram: social("https://instagram.com/", "Instagram"),
  facebook: social("https://facebook.com/", "Facebook"),
  tiktok: social("https://www.tiktok.com/@", "TikTok"),
  x: social("https://x.com/", "X"),
});

// Shows a stored link back as a short username in the form
export function socialHandle(url: unknown): string {
  if (typeof url !== "string" || !url) return "";
  try {
    const u = new URL(url);
    const known = ["instagram.com", "facebook.com", "www.tiktok.com", "tiktok.com", "x.com", "twitter.com"];
    if (!known.includes(u.hostname.replace(/^www\.(?=instagram|facebook|x\.)/, ""))) return url;
    const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return seg ? "@" + seg.replace(/^@/, "") : url;
  } catch {
    return url;
  }
}
