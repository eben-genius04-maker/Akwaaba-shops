import { z } from "zod";

const ITEM_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const checkbox = z.union([z.literal("on"), z.literal(""), z.null(), z.undefined()]).transform((v) => v === "on");
const slugField = (max: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max, `Link name is too long (max ${max} characters).`)
    .refine((s) => !s || ITEM_SLUG.test(s), "Use lowercase letters, numbers and single hyphens only.");

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(80, "Name is too long."),
  slug: slugField(100),
  description: z.string().trim().max(1000, "Description is too long.").transform((v) => v || null),
  isActive: checkbox,
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(150, "Name is too long."),
  slug: slugField(160),
  description: z.string().trim().max(10000, "Description is too long.").transform((v) => v || null),
  price: z
    .string()
    .trim()
    .transform((v) => v.replace(/[,\s]|GH₵|GHS/gi, ""))
    .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter a price like 350 or 49.99.")
    .transform(Number),
  categoryId: z
    .string()
    .trim()
    .refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), "Choose a category.")
    .transform((v) => v || null),
  stockQuantity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}$/.test(v), "Enter how many you have, e.g. 10.")
    .transform(Number),
  deliverySize: z.enum(["small", "medium", "large"], { message: "Choose a size." }),
  isActive: checkbox,
  isAvailable: checkbox,
  isFeatured: checkbox,
});

// Photos posted by the product form: an ordered list of storage paths (first = cover)
export const productImagesSchema = z
  .array(z.object({ path: z.string().min(1).max(200), alt: z.string().trim().max(200).optional() }))
  .max(8, "A product can have at most 8 photos.");
