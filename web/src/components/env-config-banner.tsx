"use client";

import { useSearchParams } from "next/navigation";

/** Shown when app routes redirect with ?config=1 (missing Supabase public env). */
export function EnvConfigBanner() {
  const sp = useSearchParams();
  if (sp.get("config") !== "1") return null;
  return (
    <div
      className="mx-4 mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm backdrop-blur-sm"
      role="alert"
    >
      <p className="font-semibold">Supabase is not configured</p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        In the <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">web</code> folder, create or edit{" "}
        <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">.env.local</code> and set{" "}
        <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        (Supabase → Project Settings → API). Save the file, then restart the dev server.
      </p>
    </div>
  );
}
