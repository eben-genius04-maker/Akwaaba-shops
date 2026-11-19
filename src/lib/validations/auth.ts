import { z } from "zod";
import { normalizeGhanaPhone } from "@/lib/format";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
  email,
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = normalizeGhanaPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid Ghana number, e.g. 024 123 4567." });
        return z.NEVER;
      }
      return n;
    }),
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });
