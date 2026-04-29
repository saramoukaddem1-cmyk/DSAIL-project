"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClientForAuthActions } from "@/lib/supabase/server-action-client";
import { withTimeout } from "@/lib/with-timeout";
import {
  SUPABASE_GET_USER_TIMEOUT_MS,
  SUPABASE_SIGN_IN_TIMEOUT_MS,
} from "@/lib/supabase/timeouts";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";

export type LoginFormState = { error: string | null };

function formatAuthFailure(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || "Unknown error";
    if (/getaddrinfo\s+ENOTFOUND/i.test(msg) || /fetch failed/i.test(msg)) {
      return "Cannot reach Supabase (network timeout). If you’re on VPN/school Wi‑Fi, try switching networks or disabling VPN. Also verify `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local`, then restart `npm run dev:fresh`.";
    }
    return msg;
  }
  return "Login failed due to an unexpected error.";
}

function isConnectTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return /ConnectTimeoutError/i.test(msg) || /UND_ERR_CONNECT_TIMEOUT/i.test(msg);
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const supabase = await createClientForAuthActions();
    const signIn = async () =>
      await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        SUPABASE_SIGN_IN_TIMEOUT_MS,
        "supabase.auth.signInWithPassword",
      );

    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null =
      null;
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null =
      null;
    try {
      const out = await signIn();
      data = out.data;
      error = out.error;
    } catch (e) {
      // One retry for transient network connect timeouts.
      if (isConnectTimeout(e)) {
        try {
          const out2 = await signIn();
          data = out2.data;
          error = out2.error;
        } catch (e2) {
          return { error: formatAuthFailure(e2) };
        }
      } else {
        return { error: formatAuthFailure(e) };
      }
    }

    if (error) {
      return { error: error.message };
    }
    if (!data.session) {
      return {
        error:
          "No active session — if email confirmation is required in Supabase, confirm your inbox first.",
      };
    }

    // Ensure the session cookie was actually written (otherwise the redirect loops back to /login).
    // This can fail in Next if cookies cannot be mutated or the Supabase call timed out.
    try {
      const { data: u } = await withTimeout(
        supabase.auth.getUser(),
        SUPABASE_GET_USER_TIMEOUT_MS,
        "supabase.auth.getUser",
      );
      if (!u.user) {
        return {
          error:
            "Signed in, but the session cookie could not be established. Try again (or restart the dev server). If it persists, check Supabase URL/key in `web/.env.local`.",
        };
      }
    } catch (e) {
      return { error: formatAuthFailure(e) };
    }

    // First-login gating: force onboarding once, then never block again.
    // We use `sku_welcome_ack_at` in `profiles.style_passport` as the persisted marker.
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
      const isFirstLogin = !ack;
      if (isFirstLogin && !isComplete) {
        redirect("/onboarding?required=1");
      }
    } catch {
      // If completion check fails, default to landing on the main page.
    }

    redirect("/chat");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: formatAuthFailure(e) };
  }
}
