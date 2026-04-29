import type { CatalogStrictFilters } from "@/lib/revolve/catalog-strict-filters";

/**
 * When `client` is `undefined`, caller uses `base` as-is.
 * When `client` is an object (including `{}`), any listed dimension not present as a key
 * is cleared; present keys set or clear that dimension.
 */
export function applyClientFilterOverrides(
  base: CatalogStrictFilters,
  client: Record<string, string | number | boolean | null> | null | undefined,
): CatalogStrictFilters {
  if (client == null) return base;
  const o: CatalogStrictFilters = { ...base };
  const has = (k: string) => Object.prototype.hasOwnProperty.call(client, k);

  if (has("color")) {
    const v = client.color;
    if (v == null || v === "") {
      o.primaryColorGroup = null;
      o.primaryColorGroupsAny = [];
    } else {
      const c = String(v).toLowerCase();
      o.primaryColorGroup = c;
      o.primaryColorGroupsAny = [c];
    }
  } else {
    o.primaryColorGroup = null;
    o.primaryColorGroupsAny = [];
  }

  if (has("category")) {
    const v = client.category;
    o.categoryType = v == null || v === "" ? null : String(v).toLowerCase();
  } else {
    o.categoryType = null;
  }

  if (has("max_price")) {
    const v = client.max_price;
    o.maxPriceUsd =
      v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))
        ? null
        : Number(v);
  } else {
    o.maxPriceUsd = null;
  }

  if (has("min_price")) {
    const v = client.min_price;
    o.minPriceUsd =
      v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))
        ? null
        : Number(v);
  } else {
    o.minPriceUsd = null;
  }

  if (has("size")) {
    const v = client.size;
    o.sizeGroupNeedles =
      v == null || v === "" ? [] : [String(v).toLowerCase().trim()];
  } else {
    o.sizeGroupNeedles = [];
  }

  if (has("brand")) {
    const v = client.brand;
    o.brandNormalizedNeedles =
      v == null || v === "" ? [] : [String(v).toLowerCase().trim()];
  } else {
    o.brandNormalizedNeedles = [];
  }

  if (has("pattern")) {
    const v = client.pattern;
    o.patternGroupsAny =
      v == null || v === "" ? [] : [String(v).toLowerCase().trim()];
  } else {
    o.patternGroupsAny = [];
  }

  if (has("occasion")) {
    const v = client.occasion;
    o.occasionGroupsAny =
      v == null || v === "" ? [] : [String(v).toLowerCase().trim()];
  } else {
    o.occasionGroupsAny = [];
  }

  if (has("gender")) {
    const v = client.gender;
    o.catalogGender = v == null || v === "" ? null : String(v).toLowerCase().trim();
  } else {
    o.catalogGender = null;
  }

  if (has("material")) {
    const v = client.material;
    if (v == null || v === "") {
      o.materialGroupsAny = [];
    } else {
      o.materialGroupsAny = String(v)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  } else {
    o.materialGroupsAny = [];
  }

  if (has("portfolio_only")) {
    const v = client.portfolio_only;
    const truthy =
      v === true ||
      v === 1 ||
      (typeof v === "string" && ["1", "true", "yes"].includes(v.toLowerCase()));
    o.portfolioOnly = Boolean(truthy);
  } else {
    o.portfolioOnly = false;
  }

  return o;
}

export function strictFiltersToDisplay(
  f: CatalogStrictFilters,
): Record<string, string | number> {
  const o: Record<string, string | number> = {};
  const colorTokens = [
    ...(f.primaryColorGroupsAny ?? []),
    ...(f.primaryColorGroup ? [f.primaryColorGroup] : []),
  ]
    .map((c) => String(c).trim().toLowerCase())
    .filter(Boolean);
  const uniqueColors = Array.from(new Set(colorTokens));
  if (uniqueColors.length) o.color = uniqueColors.join(", ");

  if (f.categoryType) o.category = f.categoryType;
  if (f.maxPriceUsd != null) o.max_price = f.maxPriceUsd;
  if (f.sizeGroupNeedles?.length) o.size = f.sizeGroupNeedles.join(", ");
  if (f.brandNormalizedNeedles?.length)
    o.brand = f.brandNormalizedNeedles.join(", ");
  return o;
}

export function buildResponseSummary(total: number): string {
  if (total === 0) {
    return "No items were found. Try removing a filter or broadening your search.";
  }
  const n = total.toLocaleString("en-US");
  return `${n} items were found.`;
}
