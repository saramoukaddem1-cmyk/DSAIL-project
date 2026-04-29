"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HeartFilled,
  HeartOutline,
} from "@/components/passport-heart-icons";

function letterBucket(name: string): string {
  const s = name.trim();
  if (!s) return "#";
  const c = s[0];
  if (/[0-9]/.test(c)) return "#";
  if (/[a-zA-Z]/.test(c)) return c.toUpperCase();
  return "#";
}

const SECTION_ORDER = [
  "#",
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
] as const;

export default function BrandsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [bRes, pRes] = await Promise.all([
        fetch("/api/brands?q=", { credentials: "include" }),
        fetch("/api/brand-portfolio", { credentials: "include" }),
      ]);
      const bJson = (await bRes.json()) as { brands?: string[]; error?: string };
      const pJson = (await pRes.json()) as { brands?: string[]; error?: string };
      if (!bRes.ok) throw new Error(bJson.error ?? "Failed to load brands");
      if (!pRes.ok) throw new Error(pJson.error ?? "Failed to load portfolio");
      setAllBrands(bJson.brands ?? []);
      setPortfolio(pJson.brands ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const portfolioSet = useMemo(
    () => new Set(portfolio.map((s) => s.toLowerCase())),
    [portfolio],
  );

  const baseList = useMemo(() => {
    let list = allBrands;
    if (savedOnly) {
      list = list.filter((b) => portfolioSet.has(b.toLowerCase()));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => b.toLowerCase().includes(q));
    }
    return list;
  }, [allBrands, savedOnly, searchQuery, portfolioSet]);

  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of baseList) {
      const L = letterBucket(b);
      if (!m.has(L)) m.set(L, []);
      m.get(L)!.push(b);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    }
    return m;
  }, [baseList]);

  const sections = useMemo(
    () => SECTION_ORDER.filter((k) => grouped.has(k)),
    [grouped],
  );

  async function toggle(brand: string) {
    const inP = portfolioSet.has(brand.toLowerCase());
    setErr(null);
    try {
      if (inP) {
        const res = await fetch(
          `/api/brand-portfolio?brandName=${encodeURIComponent(brand)}`,
          { method: "DELETE", credentials: "include" },
        );
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? "Remove failed");
        }
        setPortfolio((prev) => prev.filter((b) => b !== brand));
      } else {
        const res = await fetch("/api/brand-portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ brandName: brand }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? "Add failed");
        }
        setPortfolio((prev) =>
          [...prev, brand].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" }),
          ),
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  function scrollToSection(letter: string) {
    const id =
      letter === "#" ? "brand-section-hash" : `brand-section-${letter}`;
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const searching = Boolean(searchQuery.trim());
  const showGroupedSections = !savedOnly && !searching && sections.length > 0;

  return (
    <div className="animate-smouk-in">
      <header className="sku-app-page-header">
        <h1 className="sku-page-title">Select your favorite brands</h1>
      </header>

      <div className="sku-app-page-body space-y-6">
        <label className="block w-full max-w-2xl" htmlFor="brand-search">
          <span className="sku-label">Search</span>
          <input
            id="brand-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brands you like"
            className="mt-2 w-full rounded-2xl border border-[var(--smouk-border)] bg-[var(--smouk-surface-strong)] px-4 py-3.5 text-[var(--smouk-fg)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none transition focus:border-[var(--smouk-accent)]/50 focus:ring-2 focus:ring-[var(--smouk-glow)]/35"
          />
        </label>

        <nav
          className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-[var(--smouk-border)] pb-3"
          aria-label="Browse by letter"
        >
          <button
            type="button"
            onClick={() => setSavedOnly((v) => !v)}
            className={`inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${
              savedOnly
                ? "bg-white text-black"
                : "text-white hover:bg-white/10"
            }`}
            title="Passport brands only"
            aria-pressed={savedOnly}
          >
            <HeartFilled className="h-5 w-5" title="Passport brands" />
          </button>
          {SECTION_ORDER.map((letter) => {
            const has = grouped.has(letter);
            return (
              <button
                key={letter}
                type="button"
                disabled={!has && !savedOnly && !searching}
                onClick={() => {
                  setSavedOnly(false);
                  setSearchQuery("");
                  if (has) {
                    setTimeout(() => scrollToSection(letter), 120);
                  }
                }}
                className={`min-h-[36px] min-w-[32px] rounded-md px-1.5 text-sm font-semibold uppercase tracking-wide transition ${
                  has
                    ? "text-white hover:bg-white/10"
                    : "cursor-default text-white/40"
                }`}
              >
                {letter === "#" ? "#" : letter}
              </button>
            );
          })}
        </nav>

        {err ? (
          <p className="text-sm font-medium text-red-600" role="alert">
            {err}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 text-white/70">
            <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-[#2563eb]" />
            <span className="text-sm font-medium">Loading brands…</span>
          </div>
        ) : showGroupedSections ? (
          <div className="space-y-10">
            {sections.map((letter) => {
              const brands = grouped.get(letter) ?? [];
              const sid =
                letter === "#"
                  ? "brand-section-hash"
                  : `brand-section-${letter}`;
              return (
                <section key={letter} id={sid} className="scroll-mt-24">
                  <h2 className="mb-4 text-lg font-bold text-white">
                    {letter === "#" ? "123" : letter}
                  </h2>
                  <div className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    {brands.map((brand) => (
                      <BrandRow
                        key={brand}
                        brand={brand}
                        onPortfolio={portfolioSet.has(brand.toLowerCase())}
                        onToggle={() => void toggle(brand)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            {!sections.length ? (
              <p className="text-sm text-white/70">No designers.</p>
            ) : null}
          </div>
        ) : (
          <div>
            {searching ? (
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/70">
                Search results
              </h2>
            ) : savedOnly ? (
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/70">
                On your passport
              </h2>
            ) : null}
            <div className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {baseList.map((brand) => (
                <BrandRow
                  key={brand}
                  brand={brand}
                  onPortfolio={portfolioSet.has(brand.toLowerCase())}
                  onToggle={() => void toggle(brand)}
                />
              ))}
            </div>
            {!baseList.length ? (
              <p className="text-sm text-white/70">
                {savedOnly
                  ? "No passport brands yet. Tap a heart on any designer."
                  : searching
                    ? "No matches."
                    : "No designers."}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandRow({
  brand,
  onPortfolio,
  onToggle,
}: {
  brand: string;
  onPortfolio: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center gap-2.5 rounded-md py-1.5 pl-0 pr-2 text-left text-sm font-medium text-white transition hover:bg-white/10"
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-white"
        aria-hidden
      >
        {onPortfolio ? (
          <HeartFilled className="h-5 w-5 text-[#e11d48]" />
        ) : (
          <HeartOutline className="h-5 w-5 text-white/70 group-hover:text-white" />
        )}
      </span>
      <span className="min-w-0 leading-snug">{brand}</span>
    </button>
  );
}
