/** Passport gender — matches common catalog values. */
export const PASSPORT_GENDER_OPTIONS = ["Women", "Men"] as const;
export type PassportGenderOption = (typeof PASSPORT_GENDER_OPTIONS)[number];

const LETTER = ["XXS", "XS", "S", "M", "L", "XL", "XXL"] as const;
const NUM_W = ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16"] as const;
const WAIST = [
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
] as const;
const SHOE_US = [
  "5",
  "5.5",
  "6",
  "6.5",
  "7",
  "7.5",
  "8",
  "8.5",
  "9",
  "9.5",
  "10",
  "10.5",
  "11",
  "12",
] as const;
const SHOE_EU = ["35", "36", "37", "38", "39", "40", "41", "42"] as const;

/**
 * Per-category size shortcuts (Revolve-heavy women’s catalog; still easy to scan).
 */
export const WARDROBE_CATEGORY_ORDER = [
  {
    key: "dresses",
    label: "Dresses",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "tops",
    label: "Tops",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "skirts",
    label: "Skirts",
    sizes: [...LETTER, ...NUM_W, ...WAIST],
  },
  {
    key: "swim",
    label: "Swim",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "pants",
    label: "Pants",
    sizes: [...LETTER, ...NUM_W, ...WAIST],
  },
  {
    key: "shorts",
    label: "Shorts",
    sizes: [...LETTER, ...NUM_W, ...WAIST],
  },
  {
    key: "jeans",
    label: "Jeans",
    sizes: [...WAIST, ...LETTER],
  },
  {
    key: "outerwear",
    label: "Outerwear",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "sweaters",
    label: "Sweaters & knits",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "intimates",
    label: "Intimates",
    sizes: [
      ...LETTER,
      "32A",
      "32B",
      "32C",
      "34A",
      "34B",
      "34C",
      "34D",
      "36B",
      "36C",
    ],
  },
  {
    key: "jumpsuits",
    label: "Jumpsuits & rompers",
    sizes: [...LETTER, ...NUM_W],
  },
  {
    key: "shoes",
    label: "Shoes",
    sizes: [...SHOE_US, ...SHOE_EU],
  },
] as const;

export type WardrobeCategoryKey = (typeof WARDROBE_CATEGORY_ORDER)[number]["key"];

export const WARDROBE_CATEGORY_KEYS: readonly WardrobeCategoryKey[] =
  WARDROBE_CATEGORY_ORDER.map((c) => c.key);

export const STYLE_PASSPORT_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type StylePassportCurrency = (typeof STYLE_PASSPORT_CURRENCIES)[number];
