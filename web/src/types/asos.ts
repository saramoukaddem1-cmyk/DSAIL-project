export type AsosProduct = {
  id: string;
  name: string;
  brand: string | null;
  colour: string | null;
  /** Revolve `colors[]` — used for chat matching beyond the primary swatch name. */
  colors?: string[] | null;
  priceText: string;
  currency: string;
  image: string | null;
  buyUrl: string | null;
  /** Revolve `sizes[]` when present in catalog JSON. */
  sizes?: string[] | null;
  /** Revolve `category` path string. */
  category?: string | null;
  /** Revolve `gender` (e.g. Women / Men). */
  catalogGender?: string | null;
  /** Flattened `description` text/keywords from catalog JSON for search + display. */
  descriptionKeywords?: string | null;
  /** Numeric price when present in cleaned catalog (`price` number). */
  priceUsd?: number | null;
  /** Original / list price when on sale (optional; from catalog when available). */
  originalPriceUsd?: number | null;
  /** Secondary product image for hover crossfade (optional). */
  secondaryImage?: string | null;
  /** Cleaned catalog `category_type` (e.g. dresses, tops). */
  categoryType?: string | null;
  /** Cleaned catalog `primary_color_group` (e.g. red, ivory). */
  primaryColorGroup?: string | null;
  /** Revolve `raw_color` / swatch label (e.g. "Spice") — used to fix bad primary groups. */
  rawColor?: string | null;
  /** Cleaned catalog `size_groups` (lowercase). */
  sizeGroups?: string[] | null;
  materialGroups?: string[] | null;
  patternGroups?: string[] | null;
  occasionGroups?: string[] | null;
  /** Ranking only — never used for strict inclusion. */
  searchText?: string | null;
  brandNormalized?: string | null;
};
