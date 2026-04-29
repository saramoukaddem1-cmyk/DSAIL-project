import { StylePassportForm } from "@/components/style-passport-form";
import {
  mirrorPortfolioBrandsToPassport,
  replaceUserBrandPortfolio,
} from "@/lib/brand-portfolio-sync";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StylePassportPage() {
  const supabase = await createClient();

  let user;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, phone, style_passport")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const fallback = `user_${user.id.replace(/-/g, "").slice(0, 8)}`;
    await supabase.from("profiles").insert({
      id: user.id,
      display_name: "",
      username: fallback,
      phone: null,
      style_passport: {},
    });
    const again = await supabase
      .from("profiles")
      .select("display_name, username, phone, style_passport")
      .eq("id", user.id)
      .maybeSingle();
    profile = again.data;
  }

  const passport = normalizeStylePassport(profile?.style_passport ?? {});

  const { data: pfRows } = await supabase
    .from("user_brand_portfolio")
    .select("brand_name")
    .eq("user_id", user.id)
    .order("brand_name", { ascending: true });

  let portfolioBrands = (pfRows ?? []).map((r) => r.brand_name as string);

  if (
    portfolioBrands.length === 0 &&
    passport.brands &&
    passport.brands.length > 0
  ) {
    const { error } = await replaceUserBrandPortfolio(
      supabase,
      user.id,
      passport.brands,
    );
    if (!error) {
      await mirrorPortfolioBrandsToPassport(supabase, user.id);
      portfolioBrands = [...passport.brands].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    }
  }

  return (
    <div className="animate-smouk-in">
      <header className="sku-app-page-header">
        <h1 className="sku-page-title">Build your style passport</h1>
      </header>
      <div className="sku-app-page-body">
        <StylePassportForm
          initial={{
            phone: profile?.phone ?? "",
            passport,
            portfolioBrands,
          }}
        />
      </div>
    </div>
  );
}
