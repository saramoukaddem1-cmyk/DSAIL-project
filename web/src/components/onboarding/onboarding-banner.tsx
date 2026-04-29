"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";

type ProfileJson = {
  style_passport?: unknown;
  portfolio_brands?: string[];
  onboarding_dismissed_at?: string | null;
  sku_welcome_ack_at?: string | null;
  error?: string;
};

const LOCAL_DISMISS_KEY = "sku_onboarding_banner_dismissed_v1";

export function OnboardingBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const shouldRun = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith("/onboarding")) return false;
    if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    if (!shouldRun) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const locallyDismissed = localStorage.getItem(LOCAL_DISMISS_KEY) === "1";
        if (locallyDismissed) {
          setOpen(false);
          return;
        }
        const res = await fetch("/api/profile", { credentials: "include" });
        const json = (await res.json()) as ProfileJson;
        if (!alive) return;
        if (!res.ok) throw new Error(json.error ?? "Profile fetch failed");

        // Only show for returning users (not first-login gate).
        const ack = typeof json.sku_welcome_ack_at === "string" ? json.sku_welcome_ack_at : null;
        if (!ack) {
          setOpen(false);
          return;
        }

        const dismissedAt = typeof json.onboarding_dismissed_at === "string"
          ? Date.parse(json.onboarding_dismissed_at)
          : NaN;
        const dismissedRecently = Number.isFinite(dismissedAt);
        if (dismissedRecently) {
          setOpen(false);
          return;
        }

        const passport: StylePassport = normalizeStylePassport(json.style_passport);
        const completion = computeProfileCompletion({
          passport,
          portfolioCount: (json.portfolio_brands ?? []).length,
        });
        const isComplete = completion.completedSteps === completion.totalSteps;
        setOpen(!isComplete);
      } catch {
        setOpen(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shouldRun]);

  async function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(LOCAL_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ onboarding_dismissed_at: new Date().toISOString() }),
      });
    } catch {
      /* ignore */
    }
  }

  if (!shouldRun) return null;
  if (loading) return null;
  if (!open) return null;

  return (
    <div className="sku-app-xpad">
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-sm text-white/80">
            Finish setting up your profile for better results.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/onboarding"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
          >
            Continue setup
          </Link>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 hover:text-white"
            aria-label="Dismiss setup banner"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

