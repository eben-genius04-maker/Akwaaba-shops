import { z } from "zod";
import { RESERVED_SLUGS, SLUG_PATTERN } from "@/lib/tenant";

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(80, "Store name is too long."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Store address must be at least 3 characters.")
    .max(40, "Store address must be at most 40 characters.")
    .regex(SLUG_PATTERN, "Use only lowercase letters, numbers and hyphens (not at the start or end).")
    .refine((s) => !RESERVED_SLUGS.has(s), "That address is reserved. Please choose another."),
});
