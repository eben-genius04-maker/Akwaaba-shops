"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "./whatsapp";

// Floating "chat with the shop" button. Hidden on product, cart, checkout and order
// pages: they have their own WhatsApp button and the floating one would cover "Add to cart".
export function WhatsAppFab({ number, storeName }: { number: string; storeName: string }) {
  const path = usePathname();
  if (/\/(p\/[^/]+|order\/[^/]+|cart|checkout)\/?$/.test(path)) return null;
  return (
    <a
      href={whatsappLink(number, `Hello ${storeName}, I'm visiting your online shop.`)}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#177a43] text-white shadow-lg hover:bg-[#11612f] print:hidden"
      aria-label={`Chat with ${storeName} on WhatsApp`}
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
