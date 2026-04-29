"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClientForAuthActions } from "@/lib/supabase/server-action-client";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";

export type SignupFormState = { error: string | null; notice: string | null };

function formatAuthFailure(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || "Unknown error";
    if (/getaddrinfo\s+ENOTFOUND/i.test(msg) || /fetch failed/i.test(msg)) {
      return "Cannot reach Supabase (DNS/network). Check `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local` and your internet connection, then restart `npm run dev`.";
    }
    return msg;
  }
  return "Signup failed due to an unexpected error.";
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function signupAction(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!displayName || !username || !email || !password) {
    return {
      error: "Name, username, email, and password are required.",
      notice: null,
    };
  }

  try {
    const origin = await requestOrigin();
    const supabase = await createClientForAuthActions();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/login`,
        data: {
          display_name: displayName,
          username,
          ...(phone ? { phone } : {}),
        },
      },
    });

    if (error) {
      return { error: error.message, notice: null };
    }
    if (!data.session) {
      return {
        error: null,
        notice:
          "Check your email — we sent a verification link. After you confirm, log in here.",
      };
    }

    // First-login gating: immediately send brand new users to onboarding.
    try {
      const user = data.session.user;
      const [{ data: profile }, { data: pfRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("style_passport")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_brand_portfolio")
          .select("brand_name")
          .eq("user_id", user.id),
      ]);
      const raw = (profile?.style_passport ?? {}) as Record<string, unknown>;
      const passport: StylePassport = normalizeStylePassport(raw);
      const completion = computeProfileCompletion({
        passport,
        portfolioCount: (pfRows ?? []).length,
      });
      const ack = typeof raw.sku_welcome_ack_at === "string" ? raw.sku_welcome_ack_at : null;
      if (!ack) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("profiles")
          .update({
            updated_at: nowIso,
            style_passport: { ...raw, sku_welcome_ack_at: nowIso },
          })
          .eq("id", user.id);
      }
      const isComplete = completion.completedSteps === completion.totalSteps;
      if (!isComplete) {
        redirect("/onboarding?required=1");
      }
    } catch {
      // fall through
    }

    redirect("/chat");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: formatAuthFailure(e), notice: null };
  }
}
