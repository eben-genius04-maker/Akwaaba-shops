import { Badge } from "@/components/ui/badge";

export function PaystackBadge({ mode, status }: { mode: string | null; status: string | null }) {
  if (status === "split_broken") return <Badge tone="danger">Paystack paused</Badge>;
  if (status === "connected") return <Badge tone={mode === "live" ? "success" : "neutral"}>{mode === "live" ? "Paystack live" : "Paystack test"}</Badge>;
  return <Badge>No Paystack</Badge>;
}
