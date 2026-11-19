// Turns "Kofi's Shoes & Bags" into "kofis-shoes-bags"
export function slugify(input: string, maxLength = 40): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

// Ghana numbers → international format without "+": 0241234567 → 233241234567
export function normalizeGhanaPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00233")) digits = digits.slice(2);
  if (/^0\d{9}$/.test(digits)) digits = "233" + digits.slice(1);
  return /^233\d{9}$/.test(digits) ? digits : null;
}

// 233241234567 → 024 123 4567
export function formatGhanaPhone(intl: string): string {
  if (!/^233\d{9}$/.test(intl)) return intl;
  const local = "0" + intl.slice(3);
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function formatCedis(amount: number): string {
  return "GH₵" + amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// GhanaPost digital address: "ga1234567", "GA 123 4567" → "GA-123-4567" (null if it doesn't fit)
export function normalizeDigitalAddress(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^([A-Z]{2})(\d{3,4})(\d{4})$/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Accra" });
}
