"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "saving" | "done" | "error";

function parseHashTokens(hash: string): {
  access_token?: string;
  refresh_token?: string;
  type?: string;
} {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get("access_token") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

export function ResetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [phase, setPhase] = useState<Phase>("checking");
  const [err, setErr] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const code = sp.get("code");

  const instructions = useMemo(() => {
    if (phase === "checking") return "Validating your reset link…";
    if (phase === "saving") return "Saving your new password…";
    if (phase === "done") return "Password updated. Redirecting to log in…";
    return null;
  }, [phase]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setErr(null);
      try {
        const supabase = createClient();

        // Supabase can deliver either a `code` query param (PKCE) or tokens in the hash.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!mounted) return;
          setPhase("ready");
          return;
        }

        const tokens = parseHashTokens(window.location.hash);
        if (tokens.type && tokens.type !== "recovery") {
          throw new Error("This link is not a password recovery link.");
        }
        if (!tokens.access_token || !tokens.refresh_token) {
          throw new Error(
            "Reset link is missing session tokens. Request a new reset email.",
          );
        }

        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) throw error;
        if (!mounted) return;
        setPhase("ready");
      } catch (e) {
        if (!mounted) return;
        setPhase("error");
        setErr(e instanceof Error ? e.message : "Reset link is invalid.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [code]);

  async function onSubmit() {
    setErr(null);
    if (pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setPhase("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPhase("done");
      window.setTimeout(() => router.replace("/login"), 900);
    } catch (e) {
      setPhase("ready");
      setErr(e instanceof Error ? e.message : "Could not update password.");
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="sku-page-title">Set a new password</h1>
        <p className="sku-lead mt-1">
          {instructions ?? "Choose a new password for your account."}
        </p>
      </div>

      {phase === "ready" ? (
        <div className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--smouk-fg)]">New password</span>
            <div className="sku-input-wrap">
              <input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="sku-input px-4 py-3"
                autoComplete="new-password"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--smouk-fg)]">Confirm password</span>
            <div className="sku-input-wrap">
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="sku-input px-4 py-3"
                autoComplete="new-password"
              />
            </div>
          </label>

          {err ? (
            <p className="text-sm text-red-400/90" role="alert">
              {err}
            </p>
          ) : null}

          <button
            type="button"
            className="sku-btn-primary w-full py-3.5"
            onClick={onSubmit}
          >
            Update password
          </button>
        </div>
      ) : phase === "error" ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
          {err ?? "Reset link is invalid. Please request a new one."}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
          {instructions ?? "Working…"}
        </div>
      )}
    </div>
  );
}

