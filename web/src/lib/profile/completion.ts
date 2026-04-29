import type { StylePassport } from "@/types/style-passport";

export type ProfileCompletion = {
  step1_sizes_budget: boolean;
  step2_location: boolean;
  step3_brands: boolean;
  completedSteps: number;
  totalSteps: 3;
  progress01: number;
};

/** True when the user has saved at least one size or per-category budget cap. */
export function isWardrobeStepComplete(wardrobe: StylePassport["wardrobe"]): boolean {
  const w = wardrobe ?? {};
  for (const v of Object.values(w)) {
    if (!v) continue;
    if (Array.isArray(v.sizes) && v.sizes.some((x) => String(x).trim())) return true;
    if (typeof v.budgetMax === "number" && Number.isFinite(v.budgetMax)) return true;
  }
  return false;
}

function hasAnyWardrobeData(passport: StylePassport | null | undefined): boolean {
  return isWardrobeStepComplete(passport?.wardrobe);
}

/** Unsaved form fields — same rules as a saved `passport.location`. */
export function isLocationFieldsComplete(o: {
  country: string;
  address1: string;
  city: string;
  postal: string;
}): boolean {
  const country = o.country.trim();
  const address1 = o.address1.trim();
  const city = o.city.trim();
  const postal = o.postal.trim();
  if (country.length < 2) return false;
  if (address1.length < 1) return false;
  if (city.length < 1) return false;
  if (postal.length < 2) return false;
  return true;
}

/** A saved, complete street address (used for locale/currency context). */
export function isPassportLocationComplete(
  passport: StylePassport | null | undefined,
): boolean {
  const loc = passport?.location;
  if (!loc) return false;
  return isLocationFieldsComplete({
    country: loc.country,
    address1: loc.address1,
    city: loc.city,
    postal: loc.postal,
  });
}

export function computeProfileCompletion(args: {
  passport: StylePassport | null;
  portfolioCount: number;
}): ProfileCompletion {
  const step1 = hasAnyWardrobeData(args.passport);
  const step2 = isPassportLocationComplete(args.passport);
  const step3 = args.portfolioCount > 0;
  const completedSteps = [step1, step2, step3].filter(Boolean).length;
  const progress01 = completedSteps / 3;
  return {
    step1_sizes_budget: step1,
    step2_location: step2,
    step3_brands: step3,
    completedSteps,
    totalSteps: 3,
    progress01,
  };
}

