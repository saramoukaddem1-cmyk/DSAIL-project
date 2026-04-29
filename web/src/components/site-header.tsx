import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { SkuAnimatedLogo } from "@/components/sku-animated-logo";
import { ProfileProgressRing } from "@/components/profile-progress-ring";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import type { User } from "@supabase/supabase-js";

function initialsFromName(name: string | null | undefined): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "Me";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  const out = `${first}${last}`.toUpperCase();
  return out || "Me";
}

export async function SiteHeader() {
  let user: User | null = null;
  let profileCompletion = 0;
  let initials = "Me";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) {
    try {
      const supabase = await createClient();
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        user = data.user;
      } catch {
        const { data: sessionData } = await supabase.auth.getSession();
        user = sessionData.session?.user ?? null;
      }

      if (user) {
        try {
          const [{ data: prof }, { data: pfRows }] = await Promise.all([
            supabase
              .from("profiles")
              .select("style_passport, display_name")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("user_brand_portfolio")
              .select("brand_name")
              .eq("user_id", user.id),
          ]);
          initials = initialsFromName(prof?.display_name);
          const raw = (prof?.style_passport ?? {}) as Record<string, unknown>;
          const passport: StylePassport = normalizeStylePassport(raw);
          const completion = computeProfileCompletion({
            passport,
            portfolioCount: (pfRows ?? []).length,
          });
          profileCompletion = completion.progress01;
        } catch {
          profileCompletion = 0;
          initials = "Me";
        }
      }
    } catch {
      user = null;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(5,4,10,0.7)] backdrop-blur-[26px] saturate-150">
      <div className="sku-app-xpad flex w-full items-center justify-between py-3.5">
        <SkuAnimatedLogo />
        <nav className="flex flex-wrap items-center justify-end gap-1.5 text-sm">
          {user ? (
            <>
              <Link
                href="/chat"
                className="sku-btn-tertiary rounded-full px-3 py-2 text-xs"
              >
                Chat with SKU
              </Link>
              <div className="ml-1.5">
                {/* Progress ring + profile link */}
                <ProfileProgressRing progress01={profileCompletion} initials={initials} />
              </div>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="sku-btn-tertiary rounded-full px-3 py-2 text-xs"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="sku-btn-primary rounded-full px-4 py-2 text-xs"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
