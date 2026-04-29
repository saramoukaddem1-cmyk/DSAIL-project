/**
 * Map Revolve-style retail color names (often in `raw_color`) to our strict
 * `primary_color_group` buckets. Used when structured `primary_color_group`
 * disagrees with the merchant swatch name.
 */

const norm = (s: string) => s.trim().toLowerCase();

/** Regex → primary_color_group bucket (lowercase). First match wins. */
const RULES: Array<[RegExp, string]> = [
  [/\b(black|jet|onyx|raven)\b/i, "black"],
  [/\b(ivory|eggshell|bone)\b/i, "ivory"],
  [/\b(cream|vanilla)\b/i, "cream"],
  [/\b(white|optic\s*white|bright\s*white|off[\s-]*white)\b/i, "white"],
  [/\b(grey|gray|charcoal|heather\s*grey|heather\s*gray|slate|pewter)\b/i, "grey"],
  [/\b(brown|chocolate|espresso|mocha|cocoa|walnut)\b/i, "brown"],
  [/\b(beige|oat|sand|stone|oyster|mushroom)\b/i, "beige"],
  [/\b(tan|nude|camel|caramel|taupe|khaki)\b/i, "tan"],
  [/\b(pink|blush|rose|fuchsia|magenta|mauve|bubblegum)\b/i, "pink"],
  [/\b(red|burgundy|wine|maroon|crimson|scarlet|ruby|cherry)\b/i, "red"],
  [/\b(orange|coral|tangerine|apricot|peach)\b/i, "orange"],
  [/\b(yellow|lemon|butter|canary|gold\s*yellow)\b/i, "yellow"],
  [/\b(green|olive|sage|mint|emerald|forest|hunter)\b/i, "green"],
  [/\b(blue|navy|denim|cobalt|azure|teal|turquoise|aqua)\b/i, "blue"],
  [/\b(purple|lilac|lavender|violet|plum|eggplant)\b/i, "purple"],
  [/\b(gold|metallic\s*gold)\b/i, "gold"],
  [/\b(silver|metallic\s*silver|platinum)\b/i, "silver"],
  [/\b(multi|multicolor|multicolour|print|pattern)\b/i, "multi"],
  /** Warm “spice” family — almost never a neutral / white swatch. */
  [/\b(spice|paprika|cayenne|chili|chilli|salsa|harissa|pimento)\b/i, "red"],
  [/\b(rust|brick|terracotta|oxide|ember)\b/i, "red"],
];

/** Standalone tokens (whole field is one word). */
const SINGLETON: Record<string, string> = {
  spice: "red",
  rust: "red",
  brick: "red",
  paprika: "red",
  cayenne: "red",
  coral: "orange",
  terracotta: "red",
  crimson: "red",
  navy: "blue",
  olive: "green",
  blush: "pink",
  denim: "blue",
};

export function primaryColorHintFromRetailName(raw: string | null | undefined): string | null {
  const t = norm(raw ?? "");
  if (!t) return null;

  for (const [re, bucket] of RULES) {
    if (re.test(t)) return bucket;
  }

  const single = SINGLETON[t];
  if (single) return single;

  return null;
}
