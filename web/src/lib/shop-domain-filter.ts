import type { AsosProduct } from "@/types/asos";

export function parseAllowedShopDomains(envValue: string | undefined): string[] {
  const raw = (envValue ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Normalize: strip protocol/path if user pasted a full URL.
  const domains = raw
    .map((s) => {
      try {
        if (s.includes("://")) return new URL(s).hostname.toLowerCase();
      } catch {
        // ignore
      }
      return s.replace(/^www\./, "");
    })
    .filter(Boolean);

  return Array.from(new Set(domains));
}

export function filterProductsByAllowedDomains(
  products: AsosProduct[],
  allowedDomains: string[],
): AsosProduct[] {
  if (!allowedDomains.length) return products;
  return products.filter((p) => {
    const u = p.buyUrl?.trim();
    if (!u) return false;
    try {
      const host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  });
}

