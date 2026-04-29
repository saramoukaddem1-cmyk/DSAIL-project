import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { OnboardingClient } from "@/components/onboarding/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const required =
    String(Array.isArray(sp.required) ? sp.required[0] : sp.required ?? "") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: pfRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, phone, style_passport")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_brand_portfolio")
      .select("brand_name")
      .eq("user_id", user.id),
  ]);

  const raw = (profile?.style_passport ?? {}) as Record<string, unknown>;
  const passport: StylePassport = normalizeStylePassport(raw);
  const location_country =
    typeof raw.location_country === "string" ? raw.location_country : null;

  const completion = computeProfileCompletion({
    passport,
    portfolioCount: (pfRows ?? []).length,
  });

  return (
    <div className="animate-smouk-in">
      <header className="sku-app-page-header">
        <h1 className="sku-page-title">Set up your profile</h1>
      </header>
      <div className="sku-app-page-body">
        <OnboardingClient
          initial={{
            displayName: profile?.display_name ?? "",
            email: user.email ?? "",
            phone: profile?.phone ?? "",
            passport,
            location_country,
            portfolioBrands: (pfRows ?? []).map((r) => r.brand_name as string),
            completion,
          }}
          required={required}
        />
      </div>
    </div>
  );
}

