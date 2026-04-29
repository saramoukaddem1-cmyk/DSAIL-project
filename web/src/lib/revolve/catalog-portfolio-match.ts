/** Keys for matching catalog `brand` strings to portfolio names (punctuation variants). */
export function buildPortfolioMatchSet(brands: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of brands) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    out.add(t);
    out.add(t.replace(/\./g, ""));
    const spaced = t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    if (spaced) out.add(spaced);
    const compact = t.replace(/[^a-z0-9]/g, "");
    if (compact.length >= 2) out.add(compact);
  }
  return out;
}

export function productBrandInPortfolio(
  brand: string | null | undefined,
  keys: Set<string>,
): boolean {
  if (!brand?.trim()) return false;
  const t = brand.trim().toLowerCase();
  if (keys.has(t)) return true;
  if (keys.has(t.replace(/\./g, ""))) return true;
  const spaced = t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (spaced && keys.has(spaced)) return true;
  const compact = t.replace(/[^a-z0-9]/g, "");
  return compact.length >= 2 && keys.has(compact);
}
