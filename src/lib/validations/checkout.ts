import { z } from "zod";
import { normalizeDigitalAddress, normalizeGhanaPhone } from "@/lib/format";
import { GHANA_BOUNDS } from "@/lib/delivery";

export const cartItemsSchema = z
  .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
  .min(1, "Your cart is empty.")
  .max(50);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long (max ${max} characters).`).transform((v) => v || null);

export const checkoutSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
    phone: z.string().trim().transform((v, ctx) => {
      const n = normalizeGhanaPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid Ghana phone number, e.g. 024 123 4567." });
        return z.NEVER;
      }
      return n;
    }),
    email: z.string().trim().toLowerCase().transform((v, ctx) => {
      if (!v) return null;
      if (!z.email().safeParse(v).success) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email address, or leave it empty." });
        return z.NEVER;
      }
      return v;
    }),
    zoneId: z.string().refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), "Choose your delivery area.").transform((v) => v || null),
    lat: z.number().min(GHANA_BOUNDS.minLat).max(GHANA_BOUNDS.maxLat).nullable(),
    lng: z.number().min(GHANA_BOUNDS.minLng).max(GHANA_BOUNDS.maxLng).nullable(),
    digitalAddress: z.string().trim().transform((v, ctx) => {
      if (!v) return null;
      const n = normalizeDigitalAddress(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Digital address should look like GA-123-4567." });
        return z.NEVER;
      }
      return n;
    }),
    landmark: optionalText(300, "Directions"),
    area: optionalText(100, "Area"),
    city: optionalText(100, "City"),
    notes: optionalText(1000, "Note"),
    paymentMethod: z.enum(["pay_on_delivery", "prepaid"], { message: "Choose how you'll pay." }),
    saveAddress: z.boolean(),
    addressLabel: z.string().trim().max(40, "Label is too long.").transform((v) => v || "Home"),
    items: cartItemsSchema,
  })
  .superRefine((d, ctx) => {
    if ((d.lat === null) !== (d.lng === null)) ctx.addIssue({ code: "custom", path: ["pin"], message: "Pick your location on the map again." });
    if (!d.digitalAddress && (d.landmark?.length ?? 0) < 5) {
      ctx.addIssue({ code: "custom", path: ["landmark"], message: "Add your digital address, or directions for the rider (at least a few words)." });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
