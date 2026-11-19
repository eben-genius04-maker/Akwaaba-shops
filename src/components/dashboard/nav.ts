import type { Enums } from "@/types/database";

type Role = Enums<"member_role">;

export type NavItem = {
  section: string;   // URL segment: /dashboard/[storeId]/[section]
  label: string;
  roles: Role[];     // who sees it
  phase?: number;    // build phase, shown on placeholder pages
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { section: "", label: "Overview", roles: ["owner", "manager", "staff"], description: "Store status and setup checklist." },
  { section: "orders", label: "Orders", roles: ["owner", "manager", "staff"], phase: 8, description: "Confirm, dispatch and deliver orders, and adjust delivery fees." },
  { section: "products", label: "Products", roles: ["owner", "manager", "staff"], phase: 4, description: "Add products with photos, prices, stock and delivery size." },
  { section: "categories", label: "Categories", roles: ["owner", "manager"], phase: 4, description: "Group products so customers find them quickly." },
  { section: "delivery", label: "Delivery", roles: ["owner", "manager"], phase: 5, description: "Choose zone or distance pricing, set your prices and pickup point." },
  { section: "payments", label: "Payments", roles: ["owner"], phase: 5, description: "Pay-on-delivery rules and connecting Paystack for MoMo and card payments." },
  { section: "staff", label: "Staff", roles: ["owner"], phase: 4, description: "Invite managers and staff, and change their roles." },
  { section: "settings", label: "Settings", roles: ["owner"], phase: 4, description: "Store name, logo, description, contact details and WhatsApp number." },
];

export function navForRole(role: Role) {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
