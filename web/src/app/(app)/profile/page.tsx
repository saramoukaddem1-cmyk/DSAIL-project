import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import { ProfileTabs } from "@/components/profile/profile-tabs";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
  return (
    <div className="animate-smouk-in">
      <header className="sku-app-page-header">
        <h1 className="profile-page-title">Profile</h1>
        <p className="sku-page-intro mt-1.5 !text-white/45">
          Edits save automatically as you go
        </p>
      </header>
      <div className="sku-app-page-body">
        <ProfileTabs
          initial={{
            displayName: profile?.display_name ?? "",
            email: user.email ?? "",
            phone: profile?.phone ?? "",
            passport,
            location_country,
            portfolioBrands: (pfRows ?? []).map((r) => r.brand_name as string),
          }}
        />
      </div>
    </div>
  );
}

