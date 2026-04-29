import type { AsosProduct } from "@/types/asos";
import { productBrandInPortfolio } from "@/lib/revolve/catalog-portfolio-match";
import { primaryColorHintFromRetailName } from "@/lib/revolve/raw-color-hint";

const LOG_PREFIX = "[catalog-search]";

function parseUsdFromPriceText(priceText: string): number | null {
  const cleaned = priceText.replace(/,/g, "");
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

export type CatalogStrictFilters = {
  /** Exact `category_type` from catalog (e.g. dresses, tops). null = no constraint. */
  categoryType: string | null;
  /**
   * Exact `primary_color_group`. Kept for backwards compatibility in logs.
   * Prefer `primaryColorGroupsAny` when user supplies colors in conversation.
   */
  primaryColorGroup: string | null;
  /** If non-empty, product.primary_color_group must match one of these. */
  primaryColorGroupsAny: string[];
  /** Exact `gender` (e.g. women, men). null = no constraint. */
  catalogGender: string | null;
  maxPriceUsd: number | null;
  minPriceUsd: number | null;
  /** Any of these must appear in `size_groups` (already lowercase in catalog). */
  sizeGroupNeedles: string[];
  /** Each listed group must appear in product.material_groups (any-of per filter token: at least one token matches). */
  materialGroupsAny: string[];
  patternGroupsAny: string[];
  occasionGroupsAny: string[];
  /** Match `brand_normalized` (substring disallowed — exact token match after normalize). */
  brandNormalizedNeedles: string[];
  portfolioOnly: boolean;
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * When `primary_color_group` disagrees with the merchant swatch (`raw_color` / `colour`),
 * trust the swatch for strict color filters — fixes rows like raw "Spice" + primary "white".
 */
export function effectivePrimaryColorGroupForStrictFilter(p: AsosProduct): string | null {
  const structured = normalizeToken(p.primaryColorGroup ?? "");
  const hint = primaryColorHintFromRetailName(p.rawColor ?? p.colour ?? "");
  if (hint && structured && hint !== structured) {
    return hint;
  }
  if (structured) return structured;
  if (hint) return hint;
  return null;
}

function productNumericPrice(p: AsosProduct): number | null {
  if (p.priceUsd != null && Number.isFinite(p.priceUsd)) return p.priceUsd;
  return parseUsdFromPriceText(p.priceText);
}

function productSizeGroupSet(p: AsosProduct): Set<string> {
  const out = new Set<string>();
  const from = p.sizeGroups ?? [];
  for (const s of from) {
    const t = normalizeToken(s);
    if (t) out.add(t);
  }
  const legacy = p.sizes ?? [];
  for (const s of legacy) {
    const t = normalizeToken(s);
    if (t) out.add(t);
  }
  return out;
}

function productStringSet(arr: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const s of arr ?? []) {
    const t = normalizeToken(s);
    if (t) out.add(t);
  }
  return out;
}

/**
 * Strict catalog filter: only structured fields — no search_text, embeddings, or fuzzy blobs.
 */
export function strictCatalogProductMatches(
  p: AsosProduct,
  f: CatalogStrictFilters,
  portfolioKeys: Set<string>,
): boolean {
  if (f.categoryType != null && f.categoryType !== "") {
    const v = p.categoryType?.toLowerCase() ?? "";
    if (!v || v !== f.categoryType) return false;
  }

  if (f.primaryColorGroupsAny.length > 0) {
    const v = effectivePrimaryColorGroupForStrictFilter(p) ?? "";
    if (!v) return false;
    const ok = f.primaryColorGroupsAny.some((c) => v === normalizeToken(c));
    if (!ok) return false;
  } else if (f.primaryColorGroup != null && f.primaryColorGroup !== "") {
    const v = effectivePrimaryColorGroupForStrictFilter(p) ?? "";
    if (!v || v !== f.primaryColorGroup) return false;
  }

  if (f.catalogGender != null && f.catalogGender !== "") {
    const v = p.catalogGender?.toLowerCase() ?? "";
    if (!v || v !== f.catalogGender) return false;
  }

  if (f.maxPriceUsd != null && Number.isFinite(f.maxPriceUsd)) {
    const price = productNumericPrice(p);
    if (price == null || price > f.maxPriceUsd) return false;
  }

  if (f.minPriceUsd != null && Number.isFinite(f.minPriceUsd)) {
    const price = productNumericPrice(p);
    if (price == null || price < f.minPriceUsd) return false;
  }

  if (f.sizeGroupNeedles.length > 0) {
    const sg = productSizeGroupSet(p);
    if (!sg.size) return false;
    const ok = f.sizeGroupNeedles.some((n) => sg.has(normalizeToken(n)));
    if (!ok) return false;
  }

  if (f.materialGroupsAny.length > 0) {
    const mg = productStringSet(p.materialGroups);
    const ok = f.materialGroupsAny.some((n) => mg.has(normalizeToken(n)));
    if (!ok) return false;
  }

  if (f.patternGroupsAny.length > 0) {
    const pg = productStringSet(p.patternGroups);
    const ok = f.patternGroupsAny.some((n) => pg.has(normalizeToken(n)));
    if (!ok) return false;
  }

  if (f.occasionGroupsAny.length > 0) {
    const og = productStringSet(p.occasionGroups);
    const ok = f.occasionGroupsAny.some((n) => og.has(normalizeToken(n)));
    if (!ok) return false;
  }

  if (f.brandNormalizedNeedles.length > 0) {
    const bn = p.brandNormalized?.toLowerCase() ?? p.brand?.trim().toLowerCase() ?? "";
    if (!bn) return false;
    const ok = f.brandNormalizedNeedles.some((n) => bn === normalizeToken(n));
    if (!ok) return false;
  }

  if (f.portfolioOnly && !productBrandInPortfolio(p.brand, portfolioKeys)) {
    return false;
  }

  return true;
}

/** Ranking only: token overlap on `search_text` (never used for inclusion). */
export function rankScoreSearchTextOnly(p: AsosProduct, query: string): number {
  const q = query.trim().toLowerCase();
  const t = (p.searchText ?? "").toLowerCase();
  if (!q || !t) return 0;
  const tokens = q.split(/\s+/).filter((x) => x.length > 0);
  let score = 0;
  for (const tok of tokens) {
    if (t.includes(tok)) score += 1;
  }
  return score;
}

export function logCatalogSearchStage(
  label: string,
  payload: Record<string, unknown>,
): void {
  console.info(`${LOG_PREFIX} ${label}`, payload);
}
