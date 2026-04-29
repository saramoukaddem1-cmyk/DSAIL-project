import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Auth reads cookies — must not be statically prerendered. */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/login?config=1");
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?config=1");
  }

  let user: User | null = null;
  try {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    } catch {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
    }
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative isolate min-h-screen">
      <div className="sku-app-wash" aria-hidden />
      <div className="relative min-h-screen">
        <SiteHeader />
        <OnboardingBanner />
        <main className="sku-app-xpad w-full overflow-x-clip py-5 pb-10 sm:py-7 sm:pb-12">
          <div className="sku-app-frosted min-h-[calc(100dvh-5.5rem)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
