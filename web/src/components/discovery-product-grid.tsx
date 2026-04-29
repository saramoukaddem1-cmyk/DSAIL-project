"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AsosProduct } from "@/types/asos";

type Props = {
  query: string;
  initialProducts: AsosProduct[];
  loading?: boolean;
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  vision?: boolean;
  clientFilters?: Record<string, string | number | boolean | null> | null;
  inspoBrowse?: boolean;
  onRequestBrowse?: () => void;
};

const refinedBtn =
  "inline-flex min-h-[36px] min-w-0 flex-1 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-center text-[10px] font-semibold tracking-wide text-white/88 transition hover:border-white/25 hover:bg-white/10 sm:text-[11px]";
const refinedBtnActive =
  "inline-flex min-h-[36px] min-w-0 flex-1 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-center text-[10px] font-semibold tracking-wide text-white sm:text-[11px]";

export function DiscoveryProductGrid({
  query,
  initialProducts,
  loading: parentLoading,
  messages,
  vision,
  clientFilters,
  inspoBrowse = false,
  onRequestBrowse,
}: Props) {
  const [products, setProducts] = useState<AsosProduct[]>(initialProducts);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const catalogOffsetRef = useRef(0);
  const seedIndexRef = useRef(0);
  const [err, setErr] = useState<string | null>(null);
  const [portfolioLower, setPortfolioLower] = useState<Set<string>>(
    () => new Set(),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [toastOk, setToastOk] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
    setHasMore(true);
    setNextOffset(inspoBrowse ? 0 : initialProducts.length);
    if (inspoBrowse) {
      catalogOffsetRef.current = 0;
      seedIndexRef.current = 0;
    }
    setErr(null);
  }, [query, initialProducts, clientFilters, inspoBrowse]);

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-portfolio", {
        credentials: "include",
      });
      const json = (await res.json()) as { brands?: string[] };
      if (res.ok && json.brands) {
        setPortfolioLower(new Set(json.brands.map((b) => b.toLowerCase())));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const fetchInspoPage = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) {
        setBrowseLoading(true);
      } else {
        setLoadingMore(true);
      }
      setErr(null);
      try {
        const off = isInitial ? 0 : catalogOffsetRef.current;
        const i = isInitial ? 0 : seedIndexRef.current;
        const params = new URLSearchParams({
          offset: String(off),
          i: String(i),
          limit: "28",
        });
        const res = await fetch(`/api/inspo?${params.toString()}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          products?: AsosProduct[];
          hasMore?: boolean;
          nextCatalogOffset?: number;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Browse feed failed");
        }
        const batch = json.products ?? [];
        if (typeof json.nextCatalogOffset === "number") {
          catalogOffsetRef.current = json.nextCatalogOffset;
        } else {
          seedIndexRef.current += 1;
        }
        if (isInitial) {
          setProducts(batch);
        } else {
          setProducts((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const next = [...prev];
            for (const p of batch) {
              if (!ids.has(p.id)) {
                ids.add(p.id);
                next.push(p);
              }
            }
            return next;
          });
        }
        setHasMore(Boolean(json.hasMore));
        setNextOffset((n) => n + batch.length);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
        if (isInitial) {
          setProducts([]);
          setHasMore(false);
        }
      } finally {
        if (isInitial) {
          setBrowseLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!inspoBrowse) return;
    void fetchInspoPage(true);
  }, [inspoBrowse, fetchInspoPage]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    if (inspoBrowse) {
      await fetchInspoPage(false);
      return;
    }
    setLoadingMore(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        offset: nextOffset,
        limit: 28,
        vision: vision ?? true,
      };
      if (messages?.length) {
        body.messages = messages;
        if (clientFilters !== undefined) body.filters = clientFilters;
      }
      const res = messages?.length
        ? await fetch("/api/catalog-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          })
        : await fetch(
            `/api/catalog-search?${new URLSearchParams({
              q: query,
              offset: String(nextOffset),
              limit: "28",
              vision: String(vision ?? true ? 1 : 0),
            }).toString()}`,
            { credentials: "include" },
          );
      const json = (await res.json()) as {
        products?: AsosProduct[];
        hasMore?: boolean;
        nextOffset?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Load failed");
      const batch = json.products ?? [];
      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const next = [...prev];
        for (const p of batch) {
          if (!ids.has(p.id)) {
            ids.add(p.id);
            next.push(p);
          }
        }
        return next;
      });
      setHasMore(Boolean(json.hasMore));
      setNextOffset(
        typeof json.nextOffset === "number" ? json.nextOffset : nextOffset + batch.length,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root: null, rootMargin: "800px 0px 1200px 0px", threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, hasMore, nextOffset, loadingMore, clientFilters, inspoBrowse]);

  async function addBrand(brand: string | null) {
    if (!brand) return;
    const lower = brand.toLowerCase();
    if (portfolioLower.has(lower)) {
      setToastOk(false);
      setToast(`${brand} is already in your portfolio`);
      return;
    }
    setToast(null);
    try {
      const res = await fetch("/api/brand-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brandName: brand }),
      });
      const data = (await res.json()) as { error?: string; duplicate?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      if (data.duplicate) {
        setToastOk(false);
        setToast(`${brand} is already in your portfolio`);
      } else {
        setPortfolioLower((prev) => new Set([...prev, lower]));
        setToastOk(true);
        setToast(`${brand} saved to your style DNA`);
      }
    } catch (e) {
      setToastOk(false);
      setToast(e instanceof Error ? e.message : "Error");
    }
  }

  const sizesFor = (p: AsosProduct) => {
    const a = p.sizes?.length
      ? p.sizes
      : (p.sizeGroups ?? []).map((s) => s.toUpperCase());
    return a ?? [];
  };

  const showSkeleton =
    (inspoBrowse && browseLoading && products.length === 0) ||
    (!inspoBrowse && (parentLoading ?? false) && products.length === 0);
  const showNoSearchResults =
    !inspoBrowse &&
    !showSkeleton &&
    !parentLoading &&
    !loadingMore &&
    !browseLoading &&
    products.length === 0 &&
    Boolean(messages?.length);

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          role="status"
          className="sku-toast flex items-center gap-3 px-4 py-3 text-sm"
        >
          <span
            className={`text-xs ${
              toastOk ? "text-white/70" : "text-white/50"
            }`}
          >
            {toastOk ? "✓" : "·"}
          </span>
          {toast}
        </div>
      ) : null}

      {err ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm italic text-[var(--smouk-muted)]">
            No results found — try adjusting your search.
          </p>
        </div>
      ) : null}

      {showSkeleton ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[var(--smouk-border)] bg-[var(--smouk-surface-strong)]"
            >
              <div className="aspect-[3/4] animate-pulse bg-gradient-to-br from-[var(--smouk-accent-2)]/20 to-[var(--smouk-accent)]/10" />
            </div>
          ))}
        </div>
      ) : null}

      {showNoSearchResults ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-sm italic text-[var(--smouk-muted)]">
            No results found — try adjusting your search.
          </p>
          {onRequestBrowse ? (
            <button
              type="button"
              onClick={onRequestBrowse}
              className={`${refinedBtn} max-w-xs font-medium`}
            >
              Clear and browse
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          showNoSearchResults ? "hidden" : "grid grid-cols-2 gap-2.5 md:grid-cols-4"
        }
      >
        {products.map((p, i) => {
          const hasBrand = Boolean(p.brand);
          const saved = hasBrand && portfolioLower.has(p.brand!.toLowerCase());
          const onSale =
            p.originalPriceUsd != null &&
            p.priceUsd != null &&
            p.originalPriceUsd > p.priceUsd;
          return (
            <article
              key={p.id}
              className="sku-product-card group/card flex flex-col overflow-hidden opacity-0"
              style={{ animationDelay: `${Math.min(i, 7) * 50}ms` }}
            >
              <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[var(--smouk-bg-elevated)]">
                {p.secondaryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.secondaryImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover/card:opacity-100"
                    aria-hidden
                  />
                ) : null}
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt=""
                    className={
                      p.secondaryImage
                        ? "relative z-[1] h-full w-full object-cover object-center transition-opacity duration-300 [@media(hover:hover)]:group-hover/card:opacity-0"
                        : "h-full w-full object-cover object-center transition duration-500 group-hover/card:scale-[1.02]"
                    }
                  />
                ) : null}
                <div className="sku-card-image-overlay" aria-hidden />
              </div>

              <div className="relative z-[1] flex flex-1 flex-col gap-1.5 p-3">
                {p.brand ? (
                  <p className="sku-card-brand">
                    {p.brand}
                  </p>
                ) : null}
                <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)]">
                  {p.name}
                </h3>
                <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-0.5">
                  {onSale ? (
                    <>
                      <span
                        className="text-sm font-semibold tabular-nums text-[var(--smouk-muted)]"
                      >
                        {p.priceText || "—"}
                      </span>
                      <span className="text-xs tabular-nums text-white/40 line-through">
                        {p.originalPriceUsd != null
                          ? p.originalPriceUsd % 1 === 0
                            ? `$${Math.round(p.originalPriceUsd)}`
                            : `$${p.originalPriceUsd.toFixed(2)}`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--text)]">
                      {p.priceText || "—"}
                    </p>
                  )}
                </div>
                {sizesFor(p).length > 0 ? (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {sizesFor(p).map((s) => (
                      <span
                        key={s}
                        className="rounded border border-[var(--border-light)] px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none text-[var(--text-dim)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
                {p.buyUrl || hasBrand ? (
                  <div className="mt-2 flex w-full gap-1.5">
                    {p.buyUrl ? (
                      <a
                        href={p.buyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="sku-btn-primary inline-flex min-h-[36px] min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2 text-center text-[10px] font-semibold tracking-wide sm:text-[11px]"
                      >
                        Shop
                      </a>
                    ) : null}
                    {hasBrand ? (
                      <button
                        type="button"
                        onClick={() => void addBrand(p.brand ?? null)}
                        className={saved ? refinedBtnActive : refinedBtn}
                        aria-pressed={saved}
                      >
                        {saved ? "Brand saved" : "Save brand"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-10" />
      {loadingMore ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--smouk-dim)]">
          <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/50" />
          Loading more…
        </div>
      ) : null}
      {!hasMore && products.length > 0 ? (
        <p className="py-4 text-center text-xs text-[var(--smouk-dim)]">
          End of results.
        </p>
      ) : null}
    </div>
  );
}
