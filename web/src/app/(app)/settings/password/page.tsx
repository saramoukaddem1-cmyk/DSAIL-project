"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PasswordSettingsPage() {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSave() {
    setErr(null);
    setOk(null);
    if (pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setOk("Password updated.");
      setPw1("");
      setPw2("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-smouk-in">
      <header className="sku-app-page-header">
        <h1 className="sku-page-title">Password</h1>
        <p className="sku-lead mt-1">
          Change your password instantly. No email needed.
        </p>
      </header>

      <div className="sku-app-page-body">
        <div className="mx-auto w-full max-w-md space-y-4">
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

          {ok ? (
            <p className="text-sm text-white/70" role="status">
              {ok}
            </p>
          ) : null}
          {err ? (
            <p className="text-sm text-red-400/90" role="alert">
              {err}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="sku-btn-primary w-full py-3.5"
          >
            {saving ? "Saving…" : "Update password"}
          </button>

          <div className="pt-2 text-center text-sm">
            <Link
              href="/profile"
              className="font-medium text-[var(--smouk-fg)] underline decoration-white/40 underline-offset-4"
            >
              Back to profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

