"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AsosProduct } from "@/types/asos";
import { DiscoveryProductGrid } from "@/components/discovery-product-grid";
import { ScrollProgressBar } from "@/components/scroll-progress-bar";

type Msg = {
  role: "user" | "assistant";
  content: string;
  followUpChips?: string[];
};

type Thread = {
  id: string;
  title: string;
  userNamed?: boolean;
  createdAt: number;
  updatedAt: number;
  /** The query this thread is “about” (used for discovery feed). */
  query: string | null;
  /** First user query; stays fixed while the user refines. */
  searchAnchor?: string | null;
  /** Assistant reply + followups (optional). */
  messages: Msg[];
  /** Latest assistant one-liner for the current query. */
  assistantBrief?: string | null;
  /** Human-readable summary of active constraints. */
  constraintSummary?: string | null;
  /** Latest suggested follow-ups for quick refinements. */
  followUpChips?: string[];
  /** The message transcript used for the latest search (enables stateful pagination). */
  searchMessages?: { role: "user" | "assistant"; content: string }[];
  /** If true, we are still running slow vision verification (colors). */
  visionPending?: boolean;
  /** Cached first page for instant reopen. */
  initialProducts: AsosProduct[];
  /** Search history for this thread (scroll up to see past searches). */
  searches: { q: string; createdAt: number }[];
  /** Server-normalized filter chip state (for POST + pagination). */
  lastFilters?: Record<string, string | number | boolean> | null;
  /** 6-filter chat state (refines on every message). */
  filterState?: {
    category: string | null;
    color: string | null;
    size: string | null;
    budget: string | null;
    brand: string | null;
    description: string | null;
  };
  missingFilters?: string[] | null;
  /** Conversational one-liner above the grid. */
  responseSummary?: string | null;
};

const STORAGE_KEY = "smouk-chat-threads-v2";
const MAX_STORE_CHARS = 400_000;

const EXAMPLES = [
  "— Red midi dress for a cocktail party, size S, under $300",
  "— Linen blazer for work, neutral tones, under $400",
  "— Black heels for a wedding, size 38, under $250",
  "— Silk slip dress, champagne, size M",
  "— Casual summer set, beige, under $150",
] as const;

const DEFAULT_CHAT_QUERY = "";

/** Longer pool for the rotating hint line (hero + results assistant). */
const ROTATING_SEARCH_HINTS = EXAMPLES;

const HINT_LINE_QUOTES = ROTATING_SEARCH_HINTS;

// (Filter chips are driven by `filterState` on the active thread.)

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultThread(): Thread {
  const now = Date.now();
  return {
    id: newId(),
    title: "New search",
    userNamed: false,
    createdAt: now,
    updatedAt: now,
    query: null,
    messages: [],
    assistantBrief: null,
    constraintSummary: null,
    followUpChips: undefined,
    searchMessages: undefined,
    visionPending: false,
    initialProducts: [],
    searches: [],
    lastFilters: null,
    responseSummary: null,
    searchAnchor: null,
  };
}

function safeThread(t: unknown): Thread | null {
  if (!t || typeof t !== "object") return null;
  const r = t as Partial<Thread>;
  if (typeof r.id !== "string" || !r.id) return null;
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Date.now();
  const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : createdAt;
  const messagesRaw = Array.isArray(r.messages) ? r.messages : [];
  const messages = messagesRaw
    .map((m): Msg | null => {
      if (!m || typeof m !== "object") return null;
      const x = m as Partial<Msg>;
      if (x.role !== "user" && x.role !== "assistant") return null;
      return {
        role: x.role,
        content: String(x.content ?? ""),
        followUpChips: Array.isArray(x.followUpChips)
          ? x.followUpChips.map(String)
          : undefined,
      } satisfies Msg;
    })
    .filter((x): x is Msg => Boolean(x));
  const searchesRaw = Array.isArray(r.searches) ? r.searches : [];
  const searches = searchesRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const x = s as Partial<{ q: unknown; createdAt: unknown }>;
      const q = typeof x.q === "string" ? x.q.trim() : "";
      if (!q) return null;
      const ca = typeof x.createdAt === "number" ? x.createdAt : createdAt;
      return { q, createdAt: ca };
    })
    .filter((x): x is { q: string; createdAt: number } => Boolean(x));

  return {
    id: r.id,
    title: typeof r.title === "string" && r.title.trim() ? r.title : "New search",
    createdAt,
    updatedAt,
    userNamed: Boolean(r.userNamed),
    query: typeof r.query === "string" ? r.query : null,
    messages,
    assistantBrief:
      typeof r.assistantBrief === "string" ? r.assistantBrief : null,
    constraintSummary:
      typeof r.constraintSummary === "string" ? r.constraintSummary : null,
    followUpChips: Array.isArray(r.followUpChips)
      ? r.followUpChips.map(String).filter(Boolean).slice(0, 6)
      : undefined,
    searchMessages: Array.isArray(r.searchMessages)
      ? (r.searchMessages as Array<{ role: unknown; content: unknown }>)
          .map((m) => {
            const role = m?.role === "user" || m?.role === "assistant" ? m.role : null;
            const content = typeof m?.content === "string" ? m.content : "";
            return role ? ({ role, content } as const) : null;
          })
          .filter(
            (x): x is { role: "user" | "assistant"; content: string } => Boolean(x),
          )
          .slice(-12)
      : undefined,
    visionPending: Boolean(r.visionPending),
    initialProducts: Array.isArray(r.initialProducts)
      ? (r.initialProducts as AsosProduct[])
      : [],
    searches,
    lastFilters:
      r.lastFilters &&
      typeof r.lastFilters === "object" &&
      !Array.isArray(r.lastFilters)
        ? (Object.fromEntries(
            Object.entries(r.lastFilters as Record<string, unknown>).filter(
              ([, val]) =>
                typeof val === "string" ||
                typeof val === "number" ||
                typeof val === "boolean",
            ),
          ) as Record<string, string | number | boolean>)
        : null,
    responseSummary:
      typeof r.responseSummary === "string" ? r.responseSummary : null,
    searchAnchor:
      typeof r.searchAnchor === "string" ? r.searchAnchor : (r.query ? String(r.query) : null),
  };
}

function loadStored(): { threads: Thread[]; activeId: string | null } {
  if (typeof window === "undefined") return { threads: [], activeId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { threads: [], activeId: null };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { threads: [], activeId: null };
    const o = parsed as Record<string, unknown>;
    const threadsRaw = Array.isArray(o.threads) ? o.threads : [];
    const threads = threadsRaw
      .map(safeThread)
      .filter((x): x is Thread => Boolean(x))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const activeId = typeof o.activeId === "string" ? o.activeId : null;
    return { threads, activeId };
  } catch {
    return { threads: [], activeId: null };
  }
}

function saveStored(threads: Thread[], activeId: string | null) {
  if (typeof window === "undefined") return;
  let slice = threads;
  while (slice.length > 0) {
    try {
      const payload = { activeId, threads: slice };
      const json = JSON.stringify(payload);
      if (json.length <= MAX_STORE_CHARS) {
        localStorage.setItem(STORAGE_KEY, json);
        return;
      }
    } catch {
      /* shrink */
    }
    slice = slice.slice(0, Math.max(0, slice.length - 1));
  }
}

export function ChatPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [heroQuery, setHeroQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintRotateIdx, setHintRotateIdx] = useState(0);
  const [hideSuccessCallout, setHideSuccessCallout] = useState(false);
  const [profileHint, setProfileHint] = useState<{
    hasWardrobeSizes: boolean;
    hasBudget: boolean;
    passport?: Record<string, unknown>;
    portfolioBrands?: string[];
  } | null>(null);
  const [pickedForYou, setPickedForYou] = useState<AsosProduct[]>([]);
  const [pickedLoading, setPickedLoading] = useState(false);
  const latestSearchIdRef = useRef(0);
  const lastActiveIdForHeroRef = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintRotateIdx((i) => (i + 1) % HINT_LINE_QUOTES.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  // Past-search history sidebar removed by request.
  // We keep the server-side history API available, but the chat page no longer renders it.

  function hasExplicitColorToken(text: string): boolean {
    const t = text.toLowerCase();
    return /\b(black|white|ivory|cream|beige|tan|brown|red|burgundy|maroon|pink|purple|violet|blue|navy|green|olive|yellow|gold|orange|silver|gray|grey)\b/.test(
      t,
    );
  }

  useEffect(() => {
    const loaded = loadStored();
    const seeded = loaded.threads.length ? loaded.threads : [defaultThread()];
    const chosen =
      loaded.activeId && seeded.some((t) => t.id === loaded.activeId)
        ? loaded.activeId
        : seeded[0]?.id ?? null;
    setThreads(seeded);
    setActiveId(chosen);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        const [pRes] = await Promise.all([
          fetch("/api/profile", { credentials: "include" }),
        ]);
        if (pRes.ok) {
          const j = (await pRes.json()) as {
            style_passport?: { wardrobe?: unknown; budgetMax?: number };
            portfolio_brands?: unknown;
          };
          const w = j?.style_passport?.wardrobe as
            | Record<string, { sizes?: string[] }>
            | undefined;
          const hasWardrobeSizes = Boolean(
            w && Object.values(w).some((x) => (x.sizes?.length ?? 0) > 0),
          );
          const b = j?.style_passport?.budgetMax;
          setProfileHint({
            hasWardrobeSizes,
            hasBudget: typeof b === "number" && b > 0,
            passport: (j?.style_passport ?? {}) as unknown as Record<string, unknown>,
            portfolioBrands: Array.isArray(j?.portfolio_brands)
              ? (j.portfolio_brands as string[]).map(String)
              : [],
          });
        }
      } catch {
        setProfileHint(null);
      }
    })();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveStored(threads, activeId);
  }, [hydrated, threads, activeId]);

  /** When the active thread changes, sync the search field from that thread. */
  useEffect(() => {
    if (activeId === lastActiveIdForHeroRef.current) return;
    lastActiveIdForHeroRef.current = activeId;
    const t = threads.find((x) => x.id === activeId);
    const q = t?.query?.trim();
    setHeroQuery(q && q.length > 0 ? t!.query! : DEFAULT_CHAT_QUERY);
  }, [activeId, threads]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const hasSearch = Boolean(active?.query);
  const activeQuery = active?.query ?? "";
  void error;
  const hintLine = HINT_LINE_QUOTES[hintRotateIdx % HINT_LINE_QUOTES.length] ?? "";

  // Intentionally not shown in the UI (kept on the thread for internal logic / history).
  // const assistantBrief = active?.assistantBrief?.trim() || "";
  // const constraintSummary = active?.constraintSummary?.trim() || "";
  // Follow-up chip buttons are intentionally hidden on the chat page.

  function buildOutboundMessages(thread: Thread, nextUserText: string): Msg[] {
    const trimmed = nextUserText.trim();
    if (!trimmed) return thread.messages.slice(-12);
    const base = thread.messages.slice(-12);
    const last = base.at(-1);
    const needsAppend = !(last?.role === "user" && last.content.trim() === trimmed);
    return needsAppend ? [...base, { role: "user", content: trimmed }] : base;
  }

  const clearActive = useCallback(() => {
    if (!active) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id !== active.id
          ? t
          : {
              ...t,
              title: "New search",
              query: null,
              messages: [],
              assistantBrief: null,
              constraintSummary: null,
              followUpChips: undefined,
              searchMessages: undefined,
              visionPending: false,
              initialProducts: [],
              lastFilters: null,
              responseSummary: null,
              searchAnchor: null,
              updatedAt: Date.now(),
            },
      ),
    );
    setHeroQuery("");
    setError(null);
  }, [active]);

  const runSearch = useCallback(
    async (
      q: string,
      opts?: { silentFromHistory?: boolean },
    ) => {
      const trimmed = q.trim();
      if (!trimmed || loading || !active) return;
      if (/^(start over|clear|new search)$/i.test(trimmed)) {
        clearActive();
        return;
      }
      setLoading(true);
      setError(null);
      const searchId = Date.now();
      latestSearchIdRef.current = searchId;

      const titleCandidate =
        trimmed.length > 44 ? `${trimmed.slice(0, 44)}…` : trimmed;

      // Optimistic: set query + messages; refinements keep searchAnchor, first search sets it.
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== active.id) return t;
          const nextMessages: Msg[] = opts?.silentFromHistory
            ? [{ role: "user", content: trimmed }]
            : buildOutboundMessages(t, trimmed);
          return {
            ...t,
            title:
              t.userNamed || (t.title && t.title !== "New search")
                ? t.title
                : titleCandidate,
            query: t.query ?? trimmed,
            searchAnchor: t.searchAnchor ?? (t.query ?? trimmed),
            updatedAt: Date.now(),
            messages: nextMessages,
            initialProducts: [],
            searches: opts?.silentFromHistory
              ? t.searches
              : [
                  ...(t.searches ?? []),
                  ...(t.searches?.at(-1)?.q === trimmed
                    ? []
                    : [{ q: trimmed, createdAt: Date.now() }]),
                ],
          };
        }),
      );
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      try {
        const outboundMessages: Msg[] = opts?.silentFromHistory
          ? [{ role: "user", content: trimmed }]
          : buildOutboundMessages(active, trimmed);
        // Vision color verification is extremely slow on Windows/OneDrive (and not required for a
        // responsive chat UX). We keep it off for search requests.
        void hasExplicitColorToken;
        const prevState = active.filterState ?? null;

        // Speed: fetch products fast + extract chips in parallel.
        const fastProductsP = fetch(
          `/api/catalog-search?q=${encodeURIComponent(trimmed)}&offset=0&limit=28&vision=0&fast=1`,
          { credentials: "include" },
        );
        const extractP = fetch("/api/filter-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: trimmed, prev_state: prevState }),
        });

        // Apply fast products immediately when available (while chips are still skeletons).
        void (async () => {
          try {
            const res = await fastProductsP;
            const j = (await res.json()) as { products?: AsosProduct[] };
            if (!res.ok) return;
            if (latestSearchIdRef.current !== searchId) return;
            setThreads((prev) =>
              prev.map((t) =>
                t.id !== active.id
                  ? t
                  : {
                      ...t,
                      initialProducts: j.products ?? [],
                      updatedAt: Date.now(),
                    },
              ),
            );
          } catch {
            /* ignore */
          }
        })();

        const extractedRes = await extractP;
        const extractedJson = (await extractedRes.json()) as {
          state?: Thread["filterState"];
        };
        const extractedState =
          extractedRes.ok && extractedJson.state && typeof extractedJson.state === "object"
            ? (extractedJson.state as NonNullable<Thread["filterState"]>)
            : (prevState ?? null);

        // Show chips immediately when extraction completes (even if product refine is still running).
        if (latestSearchIdRef.current === searchId && extractedState) {
          setThreads((prev) =>
            prev.map((t) =>
              t.id !== active.id ? t : { ...t, filterState: extractedState },
            ),
          );
        }

        // Refine: re-run using extracted state (skip extraction in API).
        const refinedRes = await fetch("/api/catalog-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: outboundMessages,
            offset: 0,
            limit: 28,
            vision: false,
            filter_state: extractedState,
            skip_extract: true,
            fast: true,
          }),
        });
        const refinedJson = (await refinedRes.json()) as {
          products?: AsosProduct[];
          error?: string;
          constraintSummary?: string;
          response_summary?: string;
          filter_state?: Thread["filterState"];
        };
        if (!refinedRes.ok) throw new Error(refinedJson.error ?? "Search failed");
        if (!opts?.silentFromHistory) {
          void (async () => {
            try {
              const label = String(active.searchAnchor ?? active.query ?? trimmed).trim();
              await fetch("/api/past-searches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ label }),
              });
            } catch {
              /* ignore */
            }
          })();
        }

        if (latestSearchIdRef.current !== searchId) return;
        setThreads((prev) =>
          prev.map((t) =>
            t.id !== active.id
              ? t
              : {
                  ...t,
                  initialProducts: refinedJson.products ?? [],
                  searchMessages: outboundMessages,
                  visionPending: false,
                  constraintSummary:
                    typeof refinedJson.constraintSummary === "string"
                      ? refinedJson.constraintSummary
                      : t.constraintSummary ?? null,
                  filterState:
                    refinedJson.filter_state && typeof refinedJson.filter_state === "object"
                      ? (refinedJson.filter_state as Thread["filterState"])
                      : (extractedState ?? t.filterState),
                  responseSummary:
                    typeof refinedJson.response_summary === "string"
                      ? refinedJson.response_summary
                      : t.responseSummary ?? null,
                  updatedAt: Date.now(),
                },
          ),
        );
      } catch {
        setError("No results found — try adjusting your search.");
      } finally {
        setLoading(false);
      }
    },
    [active, clearActive, loading],
  );

  const returnToBrowse = useCallback(() => {
    clearActive();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [clearActive]);

  useEffect(() => {
    if (!hydrated) return;
    if (hasSearch) return;
    if (!profileHint) return;
    let a = true;
    setPickedLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ offset: "0", i: "0", limit: "80" });
        const res = await fetch(`/api/inspo?${params.toString()}`, {
          credentials: "include",
        });
        const j = (await res.json()) as { products?: AsosProduct[] };
        const products = Array.isArray(j.products) ? j.products : [];

        const passport = (profileHint.passport ?? {}) as Record<string, unknown>;
        const budgetMax =
          typeof passport.budgetMax === "number" && passport.budgetMax > 0
            ? passport.budgetMax
            : null;
        const loved = new Set((profileHint.portfolioBrands ?? []).map((b) => b.toLowerCase()));
        const curated = products
          .filter((p) => {
            if (budgetMax != null && typeof p.priceUsd === "number") {
              if (p.priceUsd > budgetMax) return false;
            }
            if (loved.size && p.brand) {
              return loved.has(p.brand.toLowerCase());
            }
            return true;
          })
          .slice(0, 24);

        if (!a) return;
        setPickedForYou(curated);
      } catch {
        if (!a) return;
        setPickedForYou([]);
      } finally {
        if (!a) return;
        setPickedLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, [hydrated, hasSearch, profileHint]);

  // If the user selected a past search from the navbar dropdown, run it.
  useEffect(() => {
    if (!hydrated) return;
    const run = searchParams.get("run");
    if (!run) return;
    const q = decodeURIComponent(run).trim();
    if (!q) return;
    setHeroQuery(q);
    void runSearch(q);
    // Strip the param so it doesn't auto-run again on refresh.
    router.replace("/chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Intentionally hidden: we don't echo the user's query under the mode label.
  void activeQuery;
  const hasActiveSearch = Boolean(active?.query && String(active.query).trim());
  const hasAnyChips = Boolean(
    active?.filterState &&
      Object.values(active.filterState).some((v) => Boolean(v && String(v).trim())),
  );

  const callout = useMemo(
    (): { type: "success" | "profile" | "mixed" | "missing"; text: ReactNode } | null => {
    if (!hasActiveSearch) return null;
    const st = active?.filterState ?? null;
    if (!st) return null;
    const cat = (st.category ?? "dresses").toLowerCase();
      const passportRaw: unknown = profileHint?.passport ?? null;
      const passport =
        passportRaw && typeof passportRaw === "object"
          ? (passportRaw as {
              wardrobe?: Record<string, { sizes?: string[]; budgetMax?: number }>;
              budgetMax?: number;
            })
          : null;
      const wardrobe = passport?.wardrobe;
    const savedSize =
      wardrobe?.[cat]?.sizes?.[0] ??
      wardrobe?.dresses?.sizes?.[0] ??
      null;
    const savedBudget =
      (typeof wardrobe?.[cat]?.budgetMax === "number" && wardrobe?.[cat]?.budgetMax
        ? `≤$${wardrobe?.[cat]?.budgetMax}`
        : null) ??
        (typeof passport?.budgetMax === "number" && passport?.budgetMax
          ? `≤$${passport.budgetMax}`
        : null);

    const missing: ("size" | "budget" | "color")[] = [];
    const fromProfile: { name: "size" | "budget"; value: string }[] = [];

    if (!st.size) {
      if (savedSize) fromProfile.push({ name: "size", value: String(savedSize) });
      else missing.push("size");
    }
    if (!st.budget) {
      if (savedBudget) fromProfile.push({ name: "budget", value: String(savedBudget) });
      else missing.push("budget");
    }
    if (!st.color) missing.push("color");

    // Priority: Size → Budget → Color. At most 2.
    const prioritized = missing
      .sort((a, b) => ["size", "budget", "color"].indexOf(a) - ["size", "budget", "color"].indexOf(b))
      .slice(0, 2);

    if (prioritized.length === 0 && fromProfile.length === 0) {
      return {
        type: "success" as const,
        text: "All set — showing the best matches for your search.",
      };
    }

    if (fromProfile.length > 0 && prioritized.length === 0) {
      const parts = fromProfile.map((p) => (
        <strong key={p.name}>
          {p.name} {p.value}
        </strong>
      ));
      return {
        type: "profile" as const,
        text: (
          <>
            Showing results in {parts.reduce<React.ReactNode[]>((acc, node, idx) => {
              if (idx > 0) acc.push(" and ");
              acc.push(node);
              return acc;
            }, [])}{" "}
            from your profile. Want different? Just type it.
          </>
        ),
      };
    }

    if (fromProfile.length > 0 && prioritized.length > 0) {
      const profParts = fromProfile.map((p) => `${p.name} ${p.value}`).join(" and ");
      const missParts = prioritized.map((f) => <strong key={f}>{f}</strong>);
      return {
        type: "mixed" as const,
        text: (
          <>
            Using your profile&apos;s {profParts}. Try adding your{" "}
            {missParts.reduce<React.ReactNode[]>((acc, node, idx) => {
              if (idx > 0) acc.push(" and ");
              acc.push(node);
              return acc;
            }, [])}{" "}
            for sharper results.
          </>
        ),
      };
    }

    const missParts = prioritized.map((f) => <strong key={f}>{f}</strong>);
    return {
      type: "missing" as const,
      text: (
        <>
          Want sharper results? Try adding your{" "}
          {missParts.reduce<React.ReactNode[]>((acc, node, idx) => {
            if (idx > 0) acc.push(" and ");
            acc.push(node);
            return acc;
          }, [])}{" "}
          — just type it in the chat.
        </>
      ),
    };
    },
    [active?.filterState, hasActiveSearch, profileHint],
  );

  useEffect(() => {
    setHideSuccessCallout(false);
    if (!callout || callout.type !== "success") return;
    const id = window.setTimeout(() => {
      setHideSuccessCallout(true);
    }, 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callout ? `${callout.type}:${callout.text}` : ""]);

  const refetchBtn = "sku-btn-primary inline-flex h-12 min-w-[5.5rem] shrink-0 px-4 text-sm";

  const modeQueryRaw = String(active?.searchAnchor ?? active?.query ?? "").trim();
  const modeQuery = modeQueryRaw.length > 60 ? `${modeQueryRaw.slice(0, 60)}…` : modeQueryRaw;

  return (
    <div className="relative">
      <ScrollProgressBar />
      <div className="w-full px-[22px] pb-20 pt-7 md:px-12 md:pt-8">
        <div className="mx-auto w-full max-w-[1400px]">
          {/* Errors are rendered as a friendly "no results" message in the grid. */}

          {active ? (
            <div className="space-y-6 pb-10">
              <div className="sku-search-region space-y-4 py-7">
                <div className="mode-row">
                  <span className={"mode-dot" + (hasActiveSearch ? " active" : "")} aria-hidden />
                  <span className="mode-label">
                    {hasActiveSearch ? "SKUing" : "EXPLORING"}
                  </span>
                  {!hasActiveSearch ? (
                    <span className="mode-sub">· curated for you</span>
                  ) : modeQuery ? (
                    <span className="mode-query">· “{modeQuery}”</span>
                  ) : null}
                </div>

                {!hasActiveSearch ? (
                  <h2 className="sku-chat-editorial">
                    What are you <em>looking for</em>?
                  </h2>
                ) : null}

                <div className="flex w-full min-w-0 items-stretch gap-2">
                  <div className="relative min-w-0 flex-1">
                    <div className="search-input-wrap">
                      <input
                        value={heroQuery}
                        onChange={(e) => setHeroQuery(e.target.value)}
                        placeholder={"Describe what you're looking for..."}
                        className="sku-input h-12 pl-4 pr-11 text-[15px]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const t = heroQuery.trim();
                            if (!t) return;
                            void runSearch(t);
                          }
                        }}
                        aria-label="Chat with SKU"
                      />
                    </div>
                    {hasActiveSearch ? (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-sm text-white/50 transition hover:bg-white/10 hover:text-white/90"
                        onClick={returnToBrowse}
                        title="Back to explore"
                        aria-label="Back to explore"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      const t = heroQuery.trim();
                      if (!t) return;
                      void runSearch(t);
                    }}
                    className={refetchBtn + " h-12"}
                  >
                    {loading ? "…" : "Send"}
                  </button>
                </div>

                {hasActiveSearch && hasAnyChips ? (
                  <div className="refine-hint">
                    <span className="refine-hint-icon">↻</span>
                    Refining your search — edit above or add more details
                  </div>
                ) : null}

                {!hasActiveSearch ? (
                  <p className="sku-chat-example" key={hintRotateIdx} aria-live="polite">
                    {hintLine}
                  </p>
                ) : null}

                {hasActiveSearch ? (
                  <div className="space-y-3 pt-2">
                    <button type="button" className="new-search-btn" onClick={returnToBrowse}>
                      + New search
                    </button>

                    <div className="space-y-4">
                      {hasAnyChips && active.filterState ? (
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ["CATEGORY", active.filterState.category, "category"],
                              ["COLOR", active.filterState.color, "color"],
                              ["SIZE", active.filterState.size, "size"],
                              ["BUDGET", active.filterState.budget, "budget"],
                            ] as const
                          )
                            .filter(([, v]) => Boolean(v && String(v).trim()))
                            .map(([label, value, key]) => (
                              <div key={key} className="sku-chip shrink-0">
                                <div className="inline-flex min-w-0 items-center gap-1.5 py-1.5 pr-0.5 text-left">
                                  <span className="sku-chip-label shrink-0">{label}</span>
                                  <span className="sku-chip-value min-w-0">{String(value)}</span>
                                </div>
                                <button
                                  type="button"
                                  className="sku-chip-x flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
                                  title="Remove filter"
                                  onClick={() => {
                                    const base = active.filterState ?? {
                                      category: null,
                                      color: null,
                                      size: null,
                                      budget: null,
                                      brand: null,
                                      description: null,
                                    };
                                    const next: NonNullable<Thread["filterState"]> = {
                                      category: base.category ?? null,
                                      color: base.color ?? null,
                                      size: base.size ?? null,
                                      budget: base.budget ?? null,
                                      brand: base.brand ?? null,
                                      description: base.description ?? null,
                                      [key]: null,
                                    } as NonNullable<Thread["filterState"]>;
                                    void (async () => {
                                      try {
                                        const msgs =
                                          active.searchMessages ??
                                          (modeQueryRaw
                                            ? [{ role: "user", content: modeQueryRaw }]
                                            : []);
                                        if (!msgs.length) return;
                                        setLoading(true);
                                        setError(null);
                                        const res = await fetch("/api/catalog-search", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          credentials: "include",
                                          body: JSON.stringify({
                                            messages: msgs,
                                            offset: 0,
                                            limit: 28,
                                            vision: true,
                                            filter_state: next,
                                            skip_extract: true,
                                            fast: true,
                                          }),
                                        });
                                        const j = (await res.json()) as {
                                          products?: AsosProduct[];
                                          filter_state?: Thread["filterState"];
                                          error?: string;
                                        };
                                        if (!res.ok) throw new Error(j.error ?? "Search failed");
                                        setThreads((prev) =>
                                          prev.map((t) =>
                                            t.id !== active.id
                                              ? t
                                              : {
                                                  ...t,
                                                  initialProducts: j.products ?? [],
                                                  filterState:
                                                    j.filter_state && typeof j.filter_state === "object"
                                                      ? (j.filter_state as Thread["filterState"])
                                                      : next,
                                                  updatedAt: Date.now(),
                                                },
                                          ),
                                        );
                                      } catch {
                                        setError("No results found — try adjusting your search.");
                                      } finally {
                                        setLoading(false);
                                      }
                                    })();
                                  }}
                                  aria-label={`Remove ${label}`}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                        </div>
                      ) : loading ? (
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-8 w-[108px] skeleton" />
                          ))}
                        </div>
                      ) : null}

                    </div>
                  </div>
                ) : null}
              </div>

              {!hasActiveSearch ? (
                <div className="space-y-4">
                  <h3 className="sku-chat-picked">
                    Picked for <em>you</em>
                  </h3>
                  {pickedLoading ? <p className="text-sm text-white/40">Loading…</p> : null}
                  <DiscoveryProductGrid
                    key={`${activeId}-picked`}
                    query={"Picked for you"}
                    initialProducts={pickedForYou}
                    loading={loading}
                    messages={undefined}
                    vision={true}
                    clientFilters={null}
                    inspoBrowse={false}
                    onRequestBrowse={undefined}
                  />
                </div>
              ) : (
                <div className="space-y-6 pt-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="sku-results-title">Results for your search</h3>
                    <p className="sku-results-sub">
                      {active.initialProducts.length} items · ranked by your taste
                    </p>
                  </div>
                  {callout && !(callout.type === "success" && hideSuccessCallout) ? (
                    <div
                      className={[
                        "filter-suggestion",
                        callout.type === "profile"
                          ? "profile"
                          : callout.type === "success"
                            ? "success"
                            : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={`${callout.type}:${callout.text}`}
                    >
                      <span className="filter-suggestion-icon">✦</span>
                      <span className="filter-suggestion-text">{callout.text}</span>
                    </div>
                  ) : null}
                  <div className="pt-4">
                    <DiscoveryProductGrid
                      key={`${activeId}-search`}
                      query={activeQuery}
                      initialProducts={active.initialProducts}
                      loading={loading}
                      messages={active.searchMessages}
                      vision={!active.visionPending}
                      clientFilters={null}
                      inspoBrowse={false}
                      onRequestBrowse={undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
