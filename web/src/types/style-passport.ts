import type {
  PassportGenderOption,
  StylePassportCurrency,
  WardrobeCategoryKey,
} from "@/lib/revolve/passport-presets";

export type { WardrobeCategoryKey };

export type StylePassportGender = PassportGenderOption;

export type StylePassport = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: StylePassportGender;
  /** Legacy; no longer edited in the UI — omitted on next save. */
  styles?: string[];
  colors?: string[];
  /** Brand names aligned with `user_brand_portfolio` (mirrored from portfolio). */
  brands?: string[];
  /** Stored path prefixes; matches catalog `category` strings. */
  categoryPreferences?: string[];
  /** Legacy; no longer edited in the UI — omitted on next save. */
  itemKeywords?: string[];
  preferredCurrency?: StylePassportCurrency;
  wardrobe?: Partial<
    Record<
      WardrobeCategoryKey,
      {
        sizes?: string[];
        budgetMax?: number;
      }
    >
  >;
  budgetMax?: number;
  notes?: string;
  /** Regional context (synced to Supabase `style_passport` JSON). */
  location?: {
    country: string;
    address1: string;
    address2?: string | null;
    city: string;
    region?: string | null;
    postal: string;
  };
  onboarding_dismissed_at?: string;
  /** Public URL for profile photo (stored in `style_passport` JSON). */
  avatar_url?: string;
  sku_welcome_ack_at?: string;
};
