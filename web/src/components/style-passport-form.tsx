"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HeartFilled } from "@/components/passport-heart-icons";
import {
  type StylePassportCurrency,
  PASSPORT_GENDER_OPTIONS,
  STYLE_PASSPORT_CURRENCIES,
  WARDROBE_CATEGORY_ORDER,
} from "@/lib/revolve/passport-presets";
import {
  PASSPORT_COLOR_PRESETS,
  alignToColorPresets,
} from "@/lib/revolve/passport-color-presets";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport, StylePassportGender } from "@/types/style-passport";

type Props = {
  initial: {
    phone: string;
    passport: StylePassport;
    portfolioBrands: string[];
  };
};

export function StylePassportForm({ initial }: Props) {
  const router = useRouter();
  const p = normalizeStylePassport(initial.passport ?? {});

  const [firstName, setFirstName] = useState(p.firstName ?? "");
  const [lastName, setLastName] = useState(p.lastName ?? "");
  const [phone, setPhone] = useState(p.phone ?? initial.phone ?? "");
  const [gender, setGender] = useState<StylePassportGender | "">(
    (p.gender as StylePassportGender | undefined) ?? "",
  );
  const [preferredCurrency, setPreferredCurrency] =
    useState<StylePassportCurrency>(p.preferredCurrency ?? "USD");
  const [colors, setColors] = useState(() => alignToColorPresets(p.colors ?? []));
  const [portfolioBrands, setPortfolioBrands] = useState(() =>
    [...initial.portfolioBrands].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
  );

  const portfolioBrandsSerialized = JSON.stringify(initial.portfolioBrands);

  useEffect(() => {
    const list = JSON.parse(portfolioBrandsSerialized) as string[];
    setPortfolioBrands(
      [...list].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    );
  }, [portfolioBrandsSerialized]);
  const [wardrobe, setWardrobe] = useState<NonNullable<StylePassport["wardrobe"]>>(
    () => p.wardrobe ?? {},
  );
  const [notes, setNotes] = useState(p.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInList(list: string[], value: string): string[] {
    const v = value.trim();
    if (!v) return list;
    const low = v.toLowerCase();
    return list.some((x) => x.toLowerCase() === low)
      ? list.filter((x) => x.toLowerCase() !== low)
      : [...list, v];
  }

  async function removeBrandFromPassport(brand: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/brand-portfolio?brandName=${encodeURIComponent(brand)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Could not remove brand");
      }
      setPortfolioBrands((prev) => prev.filter((b) => b !== brand));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  function updateWardrobe(
    key: (typeof WARDROBE_CATEGORY_ORDER)[number]["key"],
    patch: Partial<{ sizes: string[]; budgetMax: number | undefined }>,
  ) {
    setWardrobe((prev) => {
      const existing = prev[key] ?? {};
      return { ...prev, [key]: { ...existing, ...patch } };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Not signed in.");
      return;
    }

    const displayName = `${firstName} ${lastName}`.trim();

    const passport: StylePassport = {
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      gender: gender || undefined,
      colors: colors.length ? colors : undefined,
      brands: portfolioBrands.length ? portfolioBrands : undefined,
      preferredCurrency,
      wardrobe,
      budgetMax: deriveGlobalBudget(wardrobe),
      notes: notes.trim() || undefined,
    };

    const { error: err } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        phone: phone.trim() || null,
        style_passport: passport,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    const syncRes = await fetch("/api/brand-portfolio/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ brands: portfolioBrands }),
    });
    if (!syncRes.ok) {
      const j = (await syncRes.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not sync brands to your passport.");
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="passport-form mt-2 flex flex-col gap-6 lg:gap-8"
    >
      <section className="rounded-xl border border-black/10 bg-white/90 p-5 text-[#0b0014] shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-6">
        <h2 className="sku-section-title">About you</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-black/70">First name</span>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="min-h-[44px] rounded-lg border border-black/15 bg-white px-3 py-2 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-black/70">Last name</span>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="min-h-[44px] rounded-lg border border-black/15 bg-white px-3 py-2 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-black/70">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[44px] rounded-lg border border-black/15 bg-white px-3 py-2 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20 sm:max-w-md"
            />
          </label>
          <div className="sm:col-span-2">
            <span className="text-black/70 text-sm">Gender</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGender("")}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  gender === ""
                    ? "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#0b0014]"
                    : "border-black/10 bg-white hover:border-black/25 text-[#0b0014]"
                }`}
              >
                Prefer not to say
              </button>
              {PASSPORT_GENDER_OPTIONS.map((g) => {
                const on = gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      on
                        ? "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#0b0014]"
                        : "border-black/10 bg-white hover:border-black/25 text-[#0b0014]"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 sm:max-w-xs">
            <span className="text-black/70">Currency for budgets</span>
            <select
              value={preferredCurrency}
              onChange={(e) =>
                setPreferredCurrency(e.target.value as StylePassportCurrency)
              }
              className="min-h-[44px] rounded-lg border border-black/15 bg-white px-3 py-2 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20"
            >
              {STYLE_PASSPORT_CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white/90 p-5 text-[#0b0014] shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-6">
        <h2 className="sku-section-title">Sizes & typical spend</h2>
        <p className="mt-1 text-sm text-black/70">
          Pick your sizes and a typical maximum you&apos;d pay per item (
          {preferredCurrency}).
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {WARDROBE_CATEGORY_ORDER.map((cat) => {
            const entry = wardrobe?.[cat.key] ?? {};
            const sizes = entry.sizes ?? [];
            const budget = entry.budgetMax != null ? String(entry.budgetMax) : "";
            return (
              <div
                key={cat.key}
                className="flex min-h-[200px] flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 sm:p-5"
              >
                <p className="text-sm font-semibold text-[#0b0014]">
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.sizes.map((s) => {
                    const on = sizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          updateWardrobe(cat.key, {
                            sizes: toggleInList(sizes, s),
                          })
                        }
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                          on
                            ? "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#0b0014]"
                            : "border-black/10 bg-white hover:border-black/25 text-[#0b0014]"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-auto flex flex-col gap-1.5 text-sm">
                  <span className="text-black/70">
                    Typical max per item ({preferredCurrency})
                  </span>
                  <input
                    inputMode="decimal"
                    value={budget}
                    onChange={(e) =>
                      updateWardrobe(cat.key, {
                        budgetMax: e.target.value.trim()
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20"
                    placeholder="e.g. 250"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white/90 p-5 text-[#0b0014] shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-6">
        <h2 className="sku-section-title text-[#0b0014]">Color</h2>
        <p className="mt-1 text-sm text-black/70">
          Tap to add or remove colors for your passport.
        </p>
        <div className="mt-5 rounded-xl border border-black/10 bg-white p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {PASSPORT_COLOR_PRESETS.map((preset) => {
              const on = colors.some(
                (x) => x.toLowerCase() === preset.label.toLowerCase(),
              );
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setColors((prev) => toggleInList(prev, preset.label))
                  }
                  className={`flex min-h-[48px] w-full items-center justify-start gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs font-medium leading-snug sm:text-sm ${
                    on
                      ? "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#0b0014]"
                      : "border-black/10 bg-white hover:border-black/25 text-[#0b0014]"
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full ${preset.swatchClassName ?? "ring-1 ring-black/10"}`}
                    style={preset.swatchStyle}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-[#0b0014]">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white/90 p-5 text-[#0b0014] shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="sku-section-title mb-0">Brands</h2>
          <Link
            href="/brands"
            className="text-sm font-semibold text-[var(--smouk-accent)] underline decoration-[var(--smouk-accent)]/40 underline-offset-4 hover:decoration-[var(--smouk-accent)]"
          >
            Browse &amp; add brands
          </Link>
        </div>
        <p className="mt-3 text-sm text-black/70">
          Hearts match the Brands page — add or remove here and it updates
          everywhere.
        </p>
        {portfolioBrands.length === 0 ? (
          <p className="mt-4 text-sm text-black/60">
            No brands on your passport yet. Use{" "}
            <Link
              href="/brands"
              className="font-semibold text-[var(--smouk-accent)] underline"
            >
              Brands
            </Link>{" "}
            to add designers.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {portfolioBrands.map((brand) => (
              <li
                key={brand}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-[#0b0014]">
                  {brand}
                </span>
                <button
                  type="button"
                  onClick={() => void removeBrandFromPassport(brand)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[#e11d48] hover:bg-rose-50"
                  aria-label={`Remove ${brand} from passport`}
                >
                  <HeartFilled className="h-4 w-4" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-black/10 bg-white/90 p-5 text-[#0b0014] shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:p-6">
        <h2 className="sku-section-title">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-4 w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-[#0b0014] outline-none focus:border-black/30 focus:ring-2 focus:ring-[#2563eb]/20"
          placeholder="Fit, fabrics, anything else we should know."
        />
      </section>

      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="sku-btn-primary w-full py-3.5 sm:w-auto sm:min-w-[200px]"
      >
        {loading ? "Saving…" : "Save passport"}
      </button>
    </form>
  );
}

function deriveGlobalBudget(
  wardrobe: NonNullable<StylePassport["wardrobe"]>,
): number | undefined {
  const vals = Object.values(wardrobe ?? {})
    .map((v) => v?.budgetMax)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!vals.length) return undefined;
  return Math.max(...vals);
}
