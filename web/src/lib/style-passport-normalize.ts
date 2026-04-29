import {
  PASSPORT_GENDER_OPTIONS,
  STYLE_PASSPORT_CURRENCIES,
  WARDROBE_CATEGORY_KEYS,
  type StylePassportCurrency,
} from "@/lib/revolve/passport-presets";
import type {
  StylePassport,
  StylePassportGender,
  WardrobeCategoryKey,
} from "@/types/style-passport";

const GENDERS = new Set<string>(PASSPORT_GENDER_OPTIONS);
const CURRENCIES = new Set<string>(STYLE_PASSPORT_CURRENCIES);

const LEGACY_WARDROBE: Record<string, WardrobeCategoryKey> = {
  tops: "tops",
  bottoms: "pants",
  dresses: "dresses",
  outerwear: "outerwear",
  shoes: "shoes",
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string" && v.trim()) {
    return [v.trim()];
  }
  return [];
}

function takeWardrobeEntry(entry: unknown): {
  sizes?: string[];
  budgetMax?: number;
} | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const e = entry as Record<string, unknown>;
  const sizes = asStringArray(e.sizes);
  let budgetMax: number | undefined;
  if (typeof e.budgetMax === "number" && Number.isFinite(e.budgetMax)) {
    budgetMax = e.budgetMax;
  }
  if (!sizes.length && budgetMax == null) return null;
  return {
    ...(sizes.length ? { sizes } : {}),
    ...(budgetMax != null ? { budgetMax } : {}),
  };
}

function normalizeWardrobe(raw: unknown): StylePassport["wardrobe"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const w = raw as Record<string, unknown>;
  const out: NonNullable<StylePassport["wardrobe"]> = {};

  for (const key of WARDROBE_CATEGORY_KEYS) {
    const got = takeWardrobeEntry(w[key]);
    if (got) out[key] = got;
  }
  for (const [legacy, nk] of Object.entries(LEGACY_WARDROBE)) {
    if (out[nk]) continue;
    const got = takeWardrobeEntry(w[legacy]);
    if (got) out[nk] = got;
  }

  return Object.keys(out).length ? out : undefined;
}

function normalizeLocationFromRaw(
  raw: unknown,
): StylePassport["location"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const country = typeof o.country === "string" ? o.country.trim() : "";
  const address1 = typeof o.address1 === "string" ? o.address1.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const postal = typeof o.postal === "string" ? o.postal.trim() : "";
  if (country.length < 2) return undefined;
  if (address1.length < 1) return undefined;
  if (city.length < 1) return undefined;
  if (postal.length < 2) return undefined;
  const address2 =
    o.address2 == null
      ? undefined
      : typeof o.address2 === "string"
        ? o.address2.trim() || null
        : null;
  const region =
    o.region == null
      ? undefined
      : typeof o.region === "string"
        ? o.region.trim() || null
        : null;
  return { country, address1, address2, city, region, postal };
}

/**
 * Coerce Supabase `style_passport` jsonb into a safe shape for UI and APIs.
 */
export function normalizeStylePassport(raw: unknown): StylePassport {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;

  const genderRaw = o.gender;
  const gender: StylePassportGender | undefined =
    typeof genderRaw === "string" && GENDERS.has(genderRaw)
      ? (genderRaw as StylePassportGender)
      : undefined;

  let preferredCurrency: StylePassportCurrency | undefined;
  if (
    typeof o.preferredCurrency === "string" &&
    CURRENCIES.has(o.preferredCurrency)
  ) {
    preferredCurrency = o.preferredCurrency as StylePassportCurrency;
  }

  const itemKeywords = asStringArray(o.itemKeywords)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const out: StylePassport = {
    firstName: typeof o.firstName === "string" ? o.firstName : undefined,
    lastName: typeof o.lastName === "string" ? o.lastName : undefined,
    phone: typeof o.phone === "string" ? o.phone : undefined,
    gender,
    styles: asStringArray(o.styles),
    colors: asStringArray(o.colors),
    brands: asStringArray(o.brands),
    categoryPreferences: asStringArray(o.categoryPreferences),
    itemKeywords: itemKeywords.length ? itemKeywords : undefined,
    preferredCurrency,
    wardrobe: normalizeWardrobe(o.wardrobe),
    budgetMax:
      typeof o.budgetMax === "number" && Number.isFinite(o.budgetMax)
        ? o.budgetMax
        : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
  };
  const loc = normalizeLocationFromRaw(o.location);
  if (loc) {
    out.location = loc;
  }
  if (typeof o.onboarding_dismissed_at === "string" && o.onboarding_dismissed_at) {
    out.onboarding_dismissed_at = o.onboarding_dismissed_at;
  }
  if (typeof o.avatar_url === "string" && o.avatar_url.trim()) {
    out.avatar_url = o.avatar_url.trim();
  }
  if (typeof o.sku_welcome_ack_at === "string" && o.sku_welcome_ack_at) {
    out.sku_welcome_ack_at = o.sku_welcome_ack_at;
  }
  return out;
}
