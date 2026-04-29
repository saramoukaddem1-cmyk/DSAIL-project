import fs from "node:fs/promises";
import type { AsosProduct } from "@/types/asos";
import {
  getRevolveCatalogFilePath,
  getRevolveCatalogCandidatePaths,
  REVOLVE_CATALOG_DEFAULT_FILES,
} from "@/lib/revolve/catalog-path";
import {
  buildPortfolioMatchSet,
  productBrandInPortfolio,
} from "@/lib/revolve/catalog-portfolio-match";
import {
  strictCatalogProductMatches,
  rankScoreSearchTextOnly,
  logCatalogSearchStage,
  type CatalogStrictFilters,
} from "@/lib/revolve/catalog-strict-filters";
import { classifyPrimaryColorGroupFromImage } from "@/lib/revolve/color-vision";
import {
  applyClientFilterOverrides,
  strictFiltersToDisplay,
} from "@/lib/revolve/client-filters";

export { buildPortfolioMatchSet, productBrandInPortfolio } from "@/lib/revolve/catalog-portfolio-match";

type Cache = {
  mtimeMs: number;
  products: AsosProduct[];
  /** Built once per file version — avoids O(sort) on every Inspo paginated request. */
  sortedById: AsosProduct[];
  /** Distinct display colors from `color` / `colors[]` for passport UI. */
  facetColors: string[];
  /** Distinct `description.keywords` strings for passport “style” chips. */
  facetKeywords: string[];
};

let cache: Cache | null = null;

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function parseJsonLenient(text: string, filePath: string): unknown {
  const cleaned = text.replace(/^\uFEFF/, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    // Some datasets accidentally include a short prefix before the JSON array/object.
    // Try parsing starting at the first likely JSON token.
    const firstArray = cleaned.indexOf("[");
    const firstObj = cleaned.indexOf("{");
    const startCandidates = [firstArray, firstObj].filter((x) => x >= 0);
    const start =
      startCandidates.length > 0 ? Math.min(...startCandidates) : -1;
    if (start >= 0) {
      try {
        return JSON.parse(cleaned.slice(start)) as unknown;
      } catch {
        // fall through
      }
    }
    const preview = cleaned.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`Invalid JSON in ${filePath}. Starts with: ${preview}`);
  }
}

/** Collect searchable text from Revolve `description` (object or string). */
function flattenDescription(d: unknown): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d.trim() || null;
  if (typeof d !== "object" || Array.isArray(d)) return null;
  const parts: string[] = [];
  for (const v of Object.values(d as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
    else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string" && x.trim()) parts.push(x.trim());
      }
    }
  }
  return parts.length ? parts.join(" ") : null;
}

/** Map a scraped row into AsosProduct; accepts common Revolve-style field names. */
export function revolveRowToProduct(raw: unknown): AsosProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id =
    asString(r.id) ??
    asString(r.sku) ??
    asString(r.product_id) ??
    asString(r.productId) ??
    asString(r.url) ??
    asString(r.product_url) ??
    asString(r.link);
  if (!id) return null;

  const name =
    asString(r.name) ??
    asString(r.title) ??
    asString(r.product_name) ??
    "Product";

  const brand =
    asString(r.brand) ??
    asString(r.designer) ??
    asString(r.brand_name) ??
    null;

  let colorsList: string[] | null = null;
  if (Array.isArray(r.colors)) {
    const xs = r.colors
      .map((x) => asString(x))
      .filter((x): x is string => Boolean(x));
    if (xs.length) colorsList = xs;
  }

  const colour =
    (colorsList?.[0] ?? null) ??
    asString(r.colour) ??
    asString(r.color) ??
    (typeof r.colors === "string" ? asString(r.colors) : null);

  let sizesList: string[] | null = null;
  if (Array.isArray(r.sizes)) {
    const xs = r.sizes
      .map((x) => asString(x))
      .filter((x): x is string => Boolean(x));
    if (xs.length) sizesList = xs;
  }

  const category =
    asString(r.raw_category) ?? asString(r.category) ?? asString(r.category_type);

  const categoryType = asString(r.category_type)?.toLowerCase() ?? null;
  const primaryColorGroup =
    asString(r.primary_color_group)?.toLowerCase() ?? null;
  const rawColor = asString(r.raw_color);

  let catalogGender: string | null = null;
  const gRaw = asString(r.gender);
  if (gRaw) {
    const low = gRaw.toLowerCase();
    catalogGender =
      low === "women"
        ? "Women"
        : low === "men"
          ? "Men"
          : gRaw.charAt(0).toUpperCase() + gRaw.slice(1).toLowerCase();
  }

  let priceUsd: number | null = null;
  if (typeof r.price === "number" && Number.isFinite(r.price)) {
    priceUsd = r.price;
  }

  let priceText =
    asString(r.priceText) ??
    asString(r.display_price) ??
    asString(r.price_display) ??
    "";
  if (priceUsd != null && !priceText.trim()) {
    priceText =
      priceUsd % 1 === 0
        ? `$${Math.round(priceUsd)}`
        : `$${priceUsd.toFixed(2)}`;
  }
  if (!priceText.trim() && typeof r.price === "string") {
    priceText = r.price;
  }
  if (priceUsd == null && priceText) {
    priceUsd = parseUsdFromPriceText(priceText);
  }

  let descriptionKeywords = flattenDescription(r.description);
  if (Array.isArray(r.description_keywords)) {
    const joined = r.description_keywords
      .map((x) => asString(x))
      .filter(Boolean)
      .join(" ");
    if (joined) {
      descriptionKeywords = descriptionKeywords
        ? `${descriptionKeywords} ${joined}`
        : joined;
    }
  }

  let sizeGroupsList: string[] | null = null;
  if (Array.isArray(r.size_groups)) {
    const xs = r.size_groups
      .map((x) => asString(x)?.toLowerCase())
      .filter((x): x is string => Boolean(x));
    if (xs.length) sizeGroupsList = xs;
  }

  function lowerStringArr(key: string): string[] | null {
    const v = r[key];
    if (!Array.isArray(v)) return null;
    const xs = v
      .map((x) => asString(x)?.toLowerCase())
      .filter((x): x is string => Boolean(x));
    return xs.length ? xs : null;
  }

  const materialGroups = lowerStringArr("material_groups");
  const patternGroups = lowerStringArr("pattern_groups");
  const occasionGroups = lowerStringArr("occasion_groups");

  const searchText = asString(r.search_text);
  const brandNormalized =
    asString(r.brand_normalized)?.toLowerCase() ??
    brand?.trim().toLowerCase() ??
    null;

  const currency = (asString(r.currency) ?? "USD").toUpperCase();

  const image =
    asString(r.image) ??
    asString(r.image_url) ??
    asString(r.thumbnail) ??
    asString(r.primary_image) ??
    asString(r.img) ??
    null;

  const secondaryImage =
    asString(r.image_2) ??
    asString(r.secondary_image) ??
    asString(r.alt_image) ??
    (Array.isArray(r.images) && (r.images as unknown[]).length > 1
      ? asString((r.images as unknown[])[1] as unknown)
      : null) ??
    null;

  let originalPriceUsd: number | null = null;
  if (typeof r.original_price === "number" && Number.isFinite(r.original_price)) {
    originalPriceUsd = r.original_price;
  } else if (typeof r.msrp === "number" && Number.isFinite(r.msrp)) {
    originalPriceUsd = r.msrp;
  } else if (typeof r.compare_at === "number" && Number.isFinite(r.compare_at)) {
    originalPriceUsd = r.compare_at;
  }

  const buyUrl =
    asString(r.buyUrl) ??
    asString(r.buy_link) ??
    asString(r.url) ??
    asString(r.product_url) ??
    asString(r.link) ??
    null;

  return {
    id,
    name,
    brand,
    colour,
    ...(colorsList ? { colors: colorsList } : {}),
    priceText,
    ...(priceUsd != null ? { priceUsd } : {}),
    ...(originalPriceUsd != null ? { originalPriceUsd } : {}),
    currency,
    image,
    ...(secondaryImage ? { secondaryImage } : {}),
    buyUrl,
    ...(sizesList ? { sizes: sizesList } : {}),
    ...(category ? { category } : {}),
    ...(categoryType ? { categoryType } : {}),
    ...(primaryColorGroup ? { primaryColorGroup } : {}),
    ...(rawColor ? { rawColor } : {}),
    ...(sizeGroupsList ? { sizeGroups: sizeGroupsList } : {}),
    ...(materialGroups ? { materialGroups } : {}),
    ...(patternGroups ? { patternGroups } : {}),
    ...(occasionGroups ? { occasionGroups } : {}),
    ...(searchText ? { searchText } : {}),
    ...(brandNormalized ? { brandNormalized } : {}),
    ...(catalogGender ? { catalogGender } : {}),
    ...(descriptionKeywords ? { descriptionKeywords } : {}),
  };
}

async function loadCatalogCache(): Promise<Cache> {
  const p = getRevolveCatalogFilePath();
  let st;
  try {
    st = await fs.stat(p);
  } catch {
    throw new Error(
      `Catalog not found. Expected web/data/${REVOLVE_CATALOG_DEFAULT_FILES.join(" or web/data/")}, or set REVOLVE_CATALOG_PATH / REVOLVE_CATALOG_FILE. Checked: ${getRevolveCatalogCandidatePaths().slice(0, 24).join("; ")}.`,
    );
  }

  if (cache && cache.mtimeMs === st.mtimeMs) {
    return cache;
  }

  const text = await fs.readFile(p, "utf8");
  const parsed = parseJsonLenient(text, p);

  let rows: unknown[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const inner = o.products ?? o.items ?? o.data;
    if (Array.isArray(inner)) rows = inner;
  }
  const products: AsosProduct[] = [];
  const colorSeen = new Map<string, string>();
  const keywordSeen = new Map<string, string>();

  for (const row of rows) {
    const pr = revolveRowToProduct(row);
    if (pr) products.push(pr);

    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;

    const main = asString(r.color) ?? asString(r.colour);
    if (main) {
      const t = main.trim();
      if (t.length > 0 && t.length <= 80) {
        const low = t.toLowerCase();
        if (!colorSeen.has(low)) colorSeen.set(low, t);
      }
    }
    const colArr = r.colors;
    if (Array.isArray(colArr)) {
      for (const c of colArr) {
        const s = asString(c)?.trim();
        if (s && s.length <= 80) {
          const low = s.toLowerCase();
          if (!colorSeen.has(low)) colorSeen.set(low, s);
        }
      }
    }

    const desc = r.description;
    if (desc && typeof desc === "object" && !Array.isArray(desc)) {
      const kw = asString(
        (desc as Record<string, unknown>).keywords,
      )?.trim();
      if (kw && kw.length <= 120) {
        const low = kw.toLowerCase();
        if (!keywordSeen.has(low)) keywordSeen.set(low, kw);
      }
    }
  }

  const facetColors = Array.from(colorSeen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const facetKeywords = Array.from(keywordSeen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  const sortedById = [...products].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );

  cache = {
    mtimeMs: st.mtimeMs,
    products,
    sortedById,
    facetColors,
    facetKeywords,
  };
  return cache;
}

async function loadCatalog(): Promise<AsosProduct[]> {
  const c = await loadCatalogCache();
  return c.products;
}

/**
 * Stable-ordered slice of the full catalog for Inspo pagination (no repeating pages).
 * Sorted by `id` so layout stays predictable for the same file.
 */
export async function getRevolveCatalogSlice(
  offset: number,
  limit: number,
): Promise<{ products: AsosProduct[]; hasMore: boolean }> {
  const { sortedById } = await loadCatalogCache();
  const start = Math.max(0, Math.floor(offset));
  const take = Math.min(Math.max(1, limit), 60);
  const end = start + take;
  const products = sortedById.slice(start, end);
  return { products, hasMore: end < sortedById.length };
}

type InspoRankArgs = {
  portfolioLower: Set<string>;
  /** Union of all saved size tokens (normalized uppercase-ish). */
  sizeTokens: Set<string>;
  globalBudgetMax: number | null;
};

/**
 * Ranks a window of products for the explore feed: portfolio and passport fit first,
 * out-of-budget and weak size fit lower, stable tie-breaker on id.
 */
export function rankInspoWindow(
  products: AsosProduct[],
  args: InspoRankArgs,
): AsosProduct[] {
  const normSize = (s: string) => s.trim().toUpperCase();
  const wanted = new Set(
    [...args.sizeTokens].map((s) => s.trim().toLowerCase()).filter(Boolean),
  );

  const score = (p: AsosProduct) => {
    let sc = 0;
    const brand = p.brand?.toLowerCase();
    if (brand && args.portfolioLower.has(brand)) sc += 220;
    const usd = parseUsdFromPriceText(p.priceText ?? "");
    if (args.globalBudgetMax != null && usd != null) {
      if (usd > args.globalBudgetMax) sc -= 120;
      else if (usd <= args.globalBudgetMax) sc += 8;
    }
    const pSizes = (p.sizes ?? p.sizeGroups ?? [])
      .map((x) => normSize(String(x)))
      .filter(Boolean);
    if (wanted.size > 0) {
      const hit = pSizes.some(
        (s) => wanted.has(s.toLowerCase()) || [...wanted].some((w) => s.includes(w)),
      );
      if (hit) sc += 35;
      else sc -= 30;
    }
    return sc;
  };

  return products
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .map((x) => x.p);
}

/**
 * Explore feed slice with personalization. Reads a buffer window, ranks, then returns
 * the first `limit` rows. Pagination advances by consumed buffer to avoid re-sort churn.
 */
export async function getRevolveCatalogInspoPage(
  offset: number,
  limit: number,
  rankArgs: InspoRankArgs,
): Promise<{ products: AsosProduct[]; hasMore: boolean; nextCatalogOffset: number }> {
  const { sortedById } = await loadCatalogCache();
  const start = Math.max(0, Math.floor(offset));
  const li = Math.min(Math.max(1, limit), 40);
  const buffer = Math.min(160, li * 6);
  const end = Math.min(sortedById.length, start + buffer);
  const window = sortedById.slice(start, end);
  const ranked = rankInspoWindow(window, rankArgs);
  const products = ranked.slice(0, li);
  const nextCatalogOffset = end;
  return {
    products,
    hasMore: end < sortedById.length,
    nextCatalogOffset,
  };
}

/** Colors and keyword tags from the Revolve JSON (for style passport chips). */
export async function getPassportCatalogFacets(): Promise<{
  colors: string[];
  styles: string[];
}> {
  try {
    const c = await loadCatalogCache();
    return { colors: c.facetColors, styles: c.facetKeywords };
  } catch {
    return { colors: [], styles: [] };
  }
}

/** Unique brand names from the Revolve JSON (first-seen spelling, case-insensitive dedupe), A–Z. */
export async function getDistinctRevolveBrands(): Promise<string[]> {
  const products = await loadCatalog();
  const seen = new Map<string, string>();
  for (const p of products) {
    const raw = p.brand?.trim();
    if (!raw) continue;
    const low = raw.toLowerCase();
    if (!seen.has(low)) seen.set(low, raw);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function haystack(p: AsosProduct): string {
  const colorBits = (p.colors ?? []).join(" ");
  const sizeBits = (p.sizes ?? []).join(" ");
  return [
    p.name,
    p.brand,
    p.colour,
    colorBits,
    sizeBits,
    p.category,
    p.catalogGender,
    p.descriptionKeywords,
    p.priceText,
    p.buyUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** All user-visible facets for category / style / keyword matching. */
function productAttributeBlob(p: AsosProduct): string {
  return [
    p.category,
    p.name,
    p.brand,
    p.colour,
    ...(p.colors ?? []),
    p.descriptionKeywords,
    (p.sizes ?? []).join(" "),
    p.catalogGender,
    p.priceText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Parse a USD-ish amount from Revolve `price` strings like "$198" or "1,234.50". */
export function parseUsdFromPriceText(priceText: string): number | null {
  const cleaned = priceText.replace(/,/g, "");
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

export type RevolveChatConstraints = {
  maxUsd?: number;
  /** Passport gender — catalog rows use "Women" / "Men". */
  gender?: string;
  colorKeywords: string[];
  /** Passport palette — ranking boost only when user did not specify colors. */
  boostColorKeywords: string[];
  /** Normalized tokens to match against `product.sizes` (e.g. S, 4). */
  sizeTokens: string[];
  /** Substrings matched against category, name, description, colors, sizes. */
  categorySubstrings: string[];
  /** Designer names the user asked for (matched on `brand`). */
  brandKeywords: string[];
  /** Fabrics, fit, occasion, silhouette, etc. (matched on full attribute text). */
  detailKeywords: string[];
  /** Canonical portfolio names (from brands page / passport). */
  portfolioBrandNames: string[];
  portfolioOnly: boolean;
  /** When true, strongly favor saved brands in score + slot mix. */
  preferPortfolioBoost: boolean;
  /** If true, skip vision color verification even when colors are requested. */
  disableVisionColor?: boolean;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) break;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

function normalizeCatalogSizeToken(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^\d+(\.\d+)?$/.test(t)) return t;
  return t.toUpperCase();
}

function expandRequestedSizeTokens(tokens: string[]): Set<string> {
  const out = new Set<string>();
  const wordMap: Record<string, string> = {
    xxsmall: "XXS",
    "extra small": "XS",
    xsmall: "XS",
    small: "S",
    medium: "M",
    med: "M",
    large: "L",
    xlarge: "XL",
    "extra large": "XL",
    xxlarge: "XXL",
  };
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (wordMap[low]) {
      out.add(wordMap[low]!);
      continue;
    }
    if (/^(xxs|xs|s|m|l|xl|xxl)$/i.test(t)) {
      out.add(t.toUpperCase());
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(t)) {
      out.add(t);
      continue;
    }
    out.add(normalizeCatalogSizeToken(t));
  }
  return out;
}

/** Map user/passport size tokens to cleaned-catalog `size_groups` (lowercase). */
export function expandSizeTokensToLowerNeedles(tokens: string[]): string[] {
  const set = expandRequestedSizeTokens(tokens);
  return [...set].map((s) => s.toLowerCase());
}

function productColorHaystack(p: AsosProduct): string {
  const bits = [
    p.colour,
    ...(p.colors ?? []),
    p.name,
    p.descriptionKeywords,
  ].filter(Boolean);
  return bits.join(" ").toLowerCase();
}

function matchesBoostColors(p: AsosProduct, boosts: string[]): boolean {
  if (!boosts.length) return false;
  const hay = productColorHaystack(p);
  return boosts.some((k) => {
    const kw = k.trim().toLowerCase();
    return kw && hay.includes(kw);
  });
}

function matchesBrandKeywords(p: AsosProduct, hints: string[]): boolean {
  if (!hints.length) return true;
  const b = p.brand?.trim().toLowerCase() ?? "";
  if (!b) return false;
  return hints.some((h) => {
    const t = h.trim().toLowerCase();
    if (!t) return false;
    return b.includes(t) || t.includes(b);
  });
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

function parseStrictPrimaryColorGroupFromQuery(searchTerm: string): string | null {
  const toks = searchTerm
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Catalog uses normalized buckets like "red", "black", "ivory", etc.
  // We only return exact catalog groups (no fuzzy widening).
  const direct = new Set([
    "black",
    "white",
    "ivory",
    "cream",
    "beige",
    "tan",
    "brown",
    "grey",
    "gray",
    "red",
    "pink",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "gold",
    "silver",
    "multi",
  ]);

  for (const t of toks) {
    if (direct.has(t)) {
      // Normalize gray spelling
      if (t === "gray") return "grey";
      // Normalize cream/beige to their own group only if catalog matches; keep literal token.
      return t;
    }
  }
  return null;
}

function parseStrictCategoryTypeFromQuery(searchTerm: string): string | null {
  const toks = searchTerm
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Minimal, exact mapping to catalog category_type values. No fuzzy inclusion.
  const map: Record<string, string> = {
    dress: "dresses",
    dresses: "dresses",
    gown: "dresses",
    gowns: "dresses",
    top: "tops",
    tops: "tops",
    shirt: "tops",
    shirts: "tops",
    blouse: "tops",
    blouses: "tops",
    tee: "tops",
    tshirt: "tops",
    "t-shirt": "tops",
    sweater: "tops",
    sweaters: "tops",
    knit: "tops",
    knits: "tops",
    jacket: "outerwear",
    coats: "outerwear",
    coat: "outerwear",
    outerwear: "outerwear",
    pants: "pants",
    pant: "pants",
    trousers: "pants",
    jeans: "jeans",
    jean: "jeans",
    skirt: "skirts",
    skirts: "skirts",
    shorts: "shorts",
    short: "shorts",
    shoes: "shoes",
    heel: "shoes",
    heels: "shoes",
    sneaker: "shoes",
    sneakers: "shoes",
    boot: "shoes",
    boots: "shoes",
    bag: "accessories",
    bags: "accessories",
    accessory: "accessories",
    accessories: "accessories",
  };

  for (const t of toks) {
    const v = map[t];
    if (v) return v;
  }
  return null;
}

function parseStrictAnyOfFromQuery(
  searchTerm: string,
  allowed: readonly string[],
): string[] {
  const allow = new Set(allowed.map((x) => x.toLowerCase()));
  const toks = searchTerm
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const t of toks) {
    if (allow.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

function strictFiltersFromQueryAndConstraints(
  searchTerm: string,
  constraints: RevolveChatConstraints,
  sizeWanted: Set<string>,
  portfolioOnly: boolean,
): CatalogStrictFilters {
  const categoryType = parseStrictCategoryTypeFromQuery(searchTerm);
  const primaryColorGroup = parseStrictPrimaryColorGroupFromQuery(searchTerm);
  const colorAny = [
    primaryColorGroup,
    ...(constraints.colorKeywords ?? []),
  ]
    .map((c) => (c ? normalizeToken(String(c)) : ""))
    .filter(Boolean);
  const primaryColorGroupsAny =
    colorAny.length > 0
      ? Array.from(
          new Set(
            colorAny
              .map((c) => parseStrictPrimaryColorGroupFromQuery(c) ?? c)
              .map((c) => normalizeToken(c)),
          ),
        )
      : [];

  // Optional strict filters from query tokens (only exact normalized group values).
  // These are deliberately conservative — we do NOT try to infer synonyms here.
  const materialGroupsAny = parseStrictAnyOfFromQuery(searchTerm, [
    "lace",
    "leather",
    "denim",
    "cotton",
    "linen",
    "silk",
    "wool",
    "cashmere",
    "suede",
    "satin",
    "knit",
  ]);
  const patternGroupsAny = parseStrictAnyOfFromQuery(searchTerm, [
    "floral",
    "stripe",
    "stripes",
    "plaid",
    "check",
    "checks",
    "polka",
    "dots",
    "dot",
    "solid",
  ]).map((t) => (t === "stripes" ? "stripe" : t));
  const occasionGroupsAny = parseStrictAnyOfFromQuery(searchTerm, [
    "wedding",
    "work",
    "office",
    "party",
    "vacation",
    "casual",
    "formal",
  ]).map((t) => (t === "office" ? "work" : t));

  // Note: only structured fields are used for inclusion. Any fuzzy matching must happen AFTER.
  return {
    categoryType: categoryType ? normalizeToken(categoryType) : null,
    primaryColorGroup: primaryColorGroup ? normalizeToken(primaryColorGroup) : null,
    primaryColorGroupsAny,
    catalogGender: constraints.gender ? normalizeToken(constraints.gender) : null,
    maxPriceUsd:
      constraints.maxUsd != null && Number.isFinite(constraints.maxUsd)
        ? constraints.maxUsd
        : null,
    minPriceUsd: null,
    sizeGroupNeedles: Array.from(sizeWanted),
    materialGroupsAny,
    patternGroupsAny,
    occasionGroupsAny,
    brandNormalizedNeedles: (constraints.brandKeywords ?? [])
      .map((b) => normalizeToken(b))
      .filter(Boolean),
    portfolioOnly,
  };
}

/** Reserve the leading share of slots for portfolio brands (still in relevance order). */
function blendPortfolioFirst(
  ranked: AsosProduct[],
  portfolioKeys: Set<string>,
  finalLimit: number,
  minShare: number,
): AsosProduct[] {
  if (!portfolioKeys.size || minShare <= 0) return ranked.slice(0, finalLimit);
  const inP = ranked.filter((p) => productBrandInPortfolio(p.brand, portfolioKeys));
  const wantP = Math.min(
    inP.length,
    Math.max(1, Math.ceil(finalLimit * minShare)),
  );
  const seen = new Set<string>();
  const out: AsosProduct[] = [];
  for (const p of inP) {
    if (out.length >= wantP || out.length >= finalLimit) break;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  for (const p of ranked) {
    if (out.length >= finalLimit) break;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/**
 * Token-scored search with passport-aware filters. Uses a wide candidate pool, then
 * STRICT filters first (exact category/color/size/price/etc.), then ranks within the filtered set.
 * If no items match the strict filters, returns zero results (no silent widening).
 */
export async function searchRevolveWithChatConstraints(
  searchTerm: string,
  constraints: RevolveChatConstraints,
  opts: { finalLimit: number; poolLimit?: number } = { finalLimit: 12 },
): Promise<AsosProduct[]> {
  const finalLimit = Math.min(Math.max(1, opts.finalLimit), 80);
  const portfolioKeys = buildPortfolioMatchSet(constraints.portfolioBrandNames);

  const all = await loadCatalog();

  const sizeWanted = expandRequestedSizeTokens(constraints.sizeTokens);
  const strictFilters = strictFiltersFromQueryAndConstraints(
    searchTerm,
    constraints,
    sizeWanted,
    constraints.portfolioOnly,
  );

  logCatalogSearchStage("parsed_filters", {
    searchTerm,
    strictFilters,
  });

  const filtered = all.filter((p) =>
    strictCatalogProductMatches(p, strictFilters, portfolioKeys),
  );

  logCatalogSearchStage("after_strict_filter", {
    count: filtered.length,
  });

  if (!filtered.length) {
    // No silent widening — caller can opt into fallback later.
    return [];
  }

  // Vision color verification (most accurate).
  // If the user specified a color, enforce it by looking at the product image.
  const wantColors = (strictFilters.primaryColorGroupsAny ?? []).map((c) =>
    c.trim().toLowerCase(),
  );
  if (wantColors.length > 0 && constraints.disableVisionColor !== true && process.env.GEMINI_API_KEY?.trim()) {
    const apiKey = process.env.GEMINI_API_KEY.trim();
    const modelName = process.env.GEMINI_MODEL;
    const maxChecks = envInt("VISION_COLOR_MAX_CHECKS", 48);
    const concurrency = envInt("VISION_COLOR_CONCURRENCY", 6);
    const pool = filtered.slice(0, Math.min(filtered.length, maxChecks));
    const checks = await mapWithConcurrency(pool, concurrency, async (p) => {
      if (!p.image) return { p, ok: false, classified: false };
      try {
        const pred = await classifyPrimaryColorGroupFromImage({
          imageUrl: p.image,
          apiKey,
          modelName,
          timeoutMs: envInt("VISION_COLOR_TIMEOUT_MS", 7000),
        });
        if (!pred) return { p, ok: false, classified: false };
        return { p, ok: wantColors.includes(pred.color), classified: true };
      } catch {
        return { p, ok: false, classified: false };
      }
    });
    const visionOk = checks.filter((x) => x.ok).map((x) => x.p);
    const classifiedCount = checks.filter((x) => x.classified).length;
    logCatalogSearchStage("after_vision_color_filter", {
      count: visionOk.length,
      wantColors,
      checked: pool.length,
      classified: classifiedCount,
    });
    // If vision is down (429/billing/network), do not fail the whole request.
    if (classifiedCount === 0) {
      logCatalogSearchStage("vision_color_skipped", { reason: "no_classifications" });
    } else if (!visionOk.length) {
      return [];
    } else {
      filtered.length = 0;
      filtered.push(...visionOk);
    }
  }

  const inPortfolio = (p: AsosProduct) =>
    productBrandInPortfolio(p.brand, portfolioKeys);

  const portfolioWeight = constraints.preferPortfolioBoost ? 26 : 7;

  const rankScore = (p: AsosProduct) => {
    const base = rankScoreSearchTextOnly(p, searchTerm);
    let s = base;
    // Portfolio brands should never override query relevance.
    // Only boost saved brands if the item already matches the query tokens.
    if (inPortfolio(p) && base > 0) {
      // Cap boost so a weak match from a saved brand can't outrank a strong non-saved match.
      s += Math.min(portfolioWeight, Math.max(2, base * 2));
    }
    // Ranking-only boosts are allowed, but must never override strict inclusion.
    if (matchesBoostColors(p, constraints.boostColorKeywords)) s += 2;
    const blob = productAttributeBlob(p);
    for (const h of constraints.detailKeywords) {
      const t = h.trim().toLowerCase();
      if (t && blob.includes(t)) s += 1.1;
    }
    if (matchesBrandKeywords(p, constraints.brandKeywords)) s += 3;
    return s;
  };

  filtered.sort((a, b) => rankScore(b) - rankScore(a));

  const blended =
    constraints.preferPortfolioBoost && !constraints.portfolioOnly
      ? blendPortfolioFirst(filtered, portfolioKeys, finalLimit, 0.5)
      : filtered.slice(0, finalLimit);

  logCatalogSearchStage("final_ranked", {
    count: blended.length,
  });

  return blended;
}

export async function searchRevolveCatalogPage(
  searchTerm: string,
  constraints: RevolveChatConstraints,
  page: { offset: number; limit: number },
  opts?: {
    clientFilters?: Record<string, string | number | boolean | null> | null;
  },
): Promise<{
  products: AsosProduct[];
  total: number;
  strictFiltered: number;
  parsedFilters: CatalogStrictFilters;
  displayFilters: Record<string, string | number>;
}> {
  const all = await loadCatalog();
  const finalLimit = Math.min(Math.max(1, page.limit), 80);
  const offset = Math.max(0, Math.floor(page.offset));
  const portfolioKeys = buildPortfolioMatchSet(constraints.portfolioBrandNames);

  const sizeWanted = expandRequestedSizeTokens(constraints.sizeTokens);
  let parsedFilters = strictFiltersFromQueryAndConstraints(
    searchTerm,
    constraints,
    sizeWanted,
    constraints.portfolioOnly,
  );
  if (opts?.clientFilters != null) {
    parsedFilters = applyClientFilterOverrides(parsedFilters, opts.clientFilters);
  }
  const displayFilters = strictFiltersToDisplay(parsedFilters);

  logCatalogSearchStage("parsed_filters", { searchTerm, parsedFilters });

  const filtered = all.filter((p) =>
    strictCatalogProductMatches(p, parsedFilters, portfolioKeys),
  );

  logCatalogSearchStage("after_strict_filter", { count: filtered.length });

  if (!filtered.length) {
    return {
      products: [],
      total: 0,
      strictFiltered: 0,
      parsedFilters,
      displayFilters,
    };
  }

  const wantColors = (parsedFilters.primaryColorGroupsAny ?? []).map((c) =>
    c.trim().toLowerCase(),
  );
  if (wantColors.length > 0 && constraints.disableVisionColor !== true && process.env.GEMINI_API_KEY?.trim()) {
    const apiKey = process.env.GEMINI_API_KEY.trim();
    const modelName = process.env.GEMINI_MODEL;
    const maxChecks = envInt("VISION_COLOR_MAX_CHECKS_PAGE", 80);
    const concurrency = envInt("VISION_COLOR_CONCURRENCY", 6);
    const pool = filtered.slice(0, Math.min(filtered.length, maxChecks));
    const checks = await mapWithConcurrency(pool, concurrency, async (p) => {
      if (!p.image) return { p, ok: false, classified: false };
      try {
        const pred = await classifyPrimaryColorGroupFromImage({
          imageUrl: p.image,
          apiKey,
          modelName,
          timeoutMs: envInt("VISION_COLOR_TIMEOUT_MS", 7000),
        });
        if (!pred) return { p, ok: false, classified: false };
        return { p, ok: wantColors.includes(pred.color), classified: true };
      } catch {
        return { p, ok: false, classified: false };
      }
    });
    const visionOk = checks.filter((x) => x.ok).map((x) => x.p);
    const classifiedCount = checks.filter((x) => x.classified).length;
    logCatalogSearchStage("after_vision_color_filter", {
      count: visionOk.length,
      wantColors,
      checked: pool.length,
      classified: classifiedCount,
    });
    if (classifiedCount === 0) {
      // Vision down, keep catalog-only results.
      logCatalogSearchStage("vision_color_skipped", { reason: "no_classifications" });
    } else if (!visionOk.length) {
      return {
        products: [],
        total: 0,
        strictFiltered: 0,
        parsedFilters,
        displayFilters,
      };
    }
    if (visionOk.length > 0) {
      filtered.length = 0;
      filtered.push(...visionOk);
    }
  }

  const inPortfolio = (p: AsosProduct) =>
    productBrandInPortfolio(p.brand, portfolioKeys);

  const portfolioWeight = constraints.preferPortfolioBoost ? 26 : 7;

  const rankScore = (p: AsosProduct) => {
    const base = rankScoreSearchTextOnly(p, searchTerm);
    let s = base;
    if (inPortfolio(p) && base > 0) {
      s += Math.min(portfolioWeight, Math.max(2, base * 2));
    }
    if (matchesBoostColors(p, constraints.boostColorKeywords)) s += 2;
    const blob = productAttributeBlob(p);
    for (const h of constraints.detailKeywords) {
      const t = h.trim().toLowerCase();
      if (t && blob.includes(t)) s += 1.1;
    }
    if (matchesBrandKeywords(p, constraints.brandKeywords)) s += 3;
    return s;
  };

  filtered.sort((a, b) => rankScore(b) - rankScore(a));

  const total = filtered.length;
  const slice = filtered.slice(offset, offset + finalLimit);

  logCatalogSearchStage("final_ranked", { count: slice.length, total });

  return {
    products: slice,
    total,
    strictFiltered: filtered.length,
    parsedFilters,
    displayFilters,
  };
}

/**
 * Simple token match on name/brand/colour/price/url. Empty query returns first `limit` items.
 */
export async function searchRevolveByTerm(
  searchTerm: string,
  opts: { limit?: number } = {},
): Promise<AsosProduct[]> {
  const limit = Math.min(Math.max(1, opts.limit ?? 20), 80);
  const all = await loadCatalog();
  const q = searchTerm.trim().toLowerCase();
  if (!q) {
    return all.slice(0, limit);
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return all.slice(0, limit);
  }

  const scored = all.map((p) => {
    const h = haystack(p);
    let score = 0;
    for (const t of tokens) {
      if (h.includes(t)) score += 1;
    }
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((s) => s.score > 0).map((s) => s.p);
  const out = matched.length > 0 ? matched : all;
  return out.slice(0, limit);
}
