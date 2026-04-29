import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";

/** Writes `brands` into `profiles.style_passport` (merged with existing JSON). */
export async function mirrorPortfolioBrandsToPassport(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: rows, error: rErr } = await supabase
    .from("user_brand_portfolio")
    .select("brand_name")
    .eq("user_id", userId);

  if (rErr) return;

  const brands = (rows ?? [])
    .map((row) => row.brand_name as string)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("style_passport")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) return;

  const prev = normalizeStylePassport(prof?.style_passport ?? {});
  const next = { ...prev, brands };

  await supabase
    .from("profiles")
    .update({
      style_passport: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

/** Replaces the user’s portfolio rows to match `brands` exactly (sorted insert order). */
export async function replaceUserBrandPortfolio(
  supabase: SupabaseClient,
  userId: string,
  brands: string[],
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase
    .from("user_brand_portfolio")
    .delete()
    .eq("user_id", userId);

  if (delErr) return { error: new Error(delErr.message) };

  const unique = [...new Set(brands.map((b) => b.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  if (unique.length === 0) return { error: null };

  const { error: insErr } = await supabase.from("user_brand_portfolio").insert(
    unique.map((brand_name) => ({ user_id: userId, brand_name })),
  );

  if (insErr) return { error: new Error(insErr.message) };
  return { error: null };
}
