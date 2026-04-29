"use server";

import { headers } from "next/headers";
import { createClientForAuthActions } from "@/lib/supabase/server-action-client";

export type ForgotPasswordState = { error: string | null; notice: string | null };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required.", notice: null };
  }

  try {
    const origin = await requestOrigin();
    const supabase = await createClientForAuthActions();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) return { error: error.message, notice: null };
    return {
      error: null,
      notice: "Check your email, we sent a password reset link.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not request password reset.";
    return { error: msg, notice: null };
  }
}

