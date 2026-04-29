"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WARDROBE_CATEGORY_ORDER } from "@/lib/revolve/passport-presets";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";

/** USD tiers — None is stored as `undefined` on the wardrobe entry. */
const BUDGET_TIERS_USD = [
  50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000,
] as const;

type Wardrobe = NonNullable<StylePassport["wardrobe"]>;
type CategoryKey = (typeof WARDROBE_CATEGORY_ORDER)[number]["key"];

/**
 * Display order for profile (general → specific). Keys and per-category `sizes` arrays
 * still come from `WARDROBE_CATEGORY_ORDER` — only order changes.
 */
const PROFILE_SIZES_CATEGORY_ORDER: readonly CategoryKey[] = [
  "dresses",
  "tops",
  "skirts",
  "pants",
  "shorts",
  "jeans",
  "jumpsuits",
  "sweaters",
  "outerwear",
  "swim",
  "intimates",
  "shoes",
];

const CHIP_BASE =
  "font-mono inline-flex h-11 min-h-[2.75rem] min-w-0 shrink-0 select-none items-center justify-center rounded-xl border text-center text-[11px] font-medium leading-tight tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smouk-accent-3)]/40 sm:text-xs";
const CHIP_SIZE = "min-w-[2.75rem] px-3";
const CHIP_BUDGET = "min-w-[3.5rem] px-2.5 sm:min-w-16 sm:px-3";
const CHIP_ON =
  "border-[var(--smouk-accent-3)]/55 bg-[var(--smouk-accent-3)]/20 text-white";
const CHIP_OFF =
  "border-white/18 bg-white/12 text-white/95 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/25 hover:bg-white/[0.16] active:scale-[0.99]";

function AccordionChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-white/45 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Selected sizes, ordered to match the category’s option list. */
function orderedSelected(
  available: readonly string[],
  selected: string[] | undefined,
): string[] {
  const set = new Set(
    (selected ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean),
  );
  return available.filter((s) => set.has(s));
}

export function SizesBudgetForm({
  initialPassport,
  onStepCompleteChange,
  compact = false,
  onAutosaveStateChange,
  suppressHeaderStatus = false,
  /** Accordion: which category is open on first mount (`null` = all collapsed). */
  initialOpenCategory = null,
}: {
  initialPassport: StylePassport;
  onStepCompleteChange?: (complete: boolean) => void;
  /** Tighter padding for tab panels */
  compact?: boolean;
  /** For profile: parent shows unified save indicator */
  onAutosaveStateChange?: (state: {
    saving: boolean;
    err: string | null;
  }) => void;
  suppressHeaderStatus?: boolean;
  initialOpenCategory?: CategoryKey | null;
}) {
  const p = useMemo(
    () => normalizeStylePassport(initialPassport ?? {}),
    [initialPassport],
  );
  const [wardrobe, setWardrobe] = useState<Wardrobe>(() => p.wardrobe ?? {});
  /** Which category’s size + budget row is open (single accordion, null = all collapsed). */
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(
    () => initialOpenCategory ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const categoriesInDisplayOrder = useMemo(() => {
    const byKey = new Map(
      WARDROBE_CATEGORY_ORDER.map((c) => [c.key, c] as const),
    );
    return PROFILE_SIZES_CATEGORY_ORDER.map((k) => {
      const c = byKey.get(k);
      if (!c) {
        throw new Error(`Unknown wardrobe key: ${k}`);
      }
      return c;
    });
  }, []);

  useEffect(() => {
    onAutosaveStateChange?.({ saving, err });
  }, [saving, err, onAutosaveStateChange]);

  useEffect(() => {
    onStepCompleteChange?.(
      (() => {
        const w = wardrobe ?? {};
        for (const v of Object.values(w)) {
          if (!v) continue;
          if (Array.isArray(v.sizes) && v.sizes.some((x) => String(x).trim())) {
            return true;
          }
          if (typeof v.budgetMax === "number" && Number.isFinite(v.budgetMax)) {
            return true;
          }
        }
        return false;
      })(),
    );
  }, [wardrobe, onStepCompleteChange]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void (async () => {
        setErr(null);
        setSaving(true);
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          const passport: StylePassport = {
            ...(p as StylePassport),
            wardrobe,
          };

          const { error } = await supabase
            .from("profiles")
            .update({
              style_passport: passport as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
          if (error) throw new Error(error.message);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Save failed");
        } finally {
          setSaving(false);
        }
      })();
    }, 650);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(wardrobe)]);

  function toggleSize(key: CategoryKey, option: string) {
    setWardrobe((prev) => {
      const existing = prev[key] ?? {};
      const cat = WARDROBE_CATEGORY_ORDER.find((c) => c.key === key)!;
      const available = cat.sizes as readonly string[];
      const current = orderedSelected(available, existing.sizes);
      const has = current.includes(option);
      const nextSizes = has
        ? current.filter((s) => s !== option)
        : orderedSelected(available, [...current, option]);
      return {
        ...prev,
        [key]: {
          ...existing,
          sizes: nextSizes,
        },
      };
    });
  }

  function setBudget(key: CategoryKey, budgetMax: number | undefined) {
    setWardrobe((prev) => {
      const existing = prev[key] ?? {};
      const cat = WARDROBE_CATEGORY_ORDER.find((c) => c.key === key)!;
      const sizes = orderedSelected(cat.sizes as readonly string[], existing.sizes);
      return {
        ...prev,
        [key]: {
          ...existing,
          sizes,
          budgetMax,
        },
      };
    });
  }

  const showHeaderStatus = !suppressHeaderStatus;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div
        className={
          "mb-1 flex flex-wrap items-end justify-between gap-3 " +
          (suppressHeaderStatus ? "pr-0 sm:pr-28" : "")
        }
      >
        <div className="min-w-0">
          <h2 className="profile-section-title sm:text-lg">
            Preferred sizes & budgets
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Set your average size and spend per category
          </p>
        </div>
        {showHeaderStatus ? (
          <div
            className={
              "shrink-0 " +
              (compact ? "text-[11px] " : "text-xs ") +
              (err ? "text-red-300" : "text-white/50")
            }
          >
            {saving ? "Saving…" : err ? err : "Saved"}
          </div>
        ) : null}
      </div>

      <div
        className={
          compact
            ? "w-full"
            : "rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
        }
      >
        <div className="flex w-full flex-col">
          {categoriesInDisplayOrder.map((cat, idx) => {
            const isOpen = openCategory === cat.key;
            const entry = wardrobe[cat.key] ?? {};
            const budgetMax = entry.budgetMax;
            const selected = new Set(
              orderedSelected(
                cat.sizes as readonly string[],
                entry.sizes,
              ),
            );
            const panelId = `sizes-budget-panel-${cat.key}`;
            return (
              <div
                key={cat.key}
                className={idx > 0 ? "border-t border-white/10" : ""}
              >
                <button
                  type="button"
                  id={`sizes-budget-trigger-${cat.key}`}
                  className="flex w-full items-center justify-between gap-3 rounded-lg py-4 text-left transition hover:bg-white/[0.04] sm:py-4"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => {
                    setOpenCategory((prev) => (prev === cat.key ? null : cat.key));
                  }}
                >
                  <span className="font-display text-[0.9375rem] font-semibold leading-snug tracking-tight text-white sm:text-base">
                    {cat.label}
                  </span>
                  <AccordionChevron open={isOpen} />
                </button>

                {isOpen ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={`sizes-budget-trigger-${cat.key}`}
                    className="space-y-0 pt-0 pb-8 sm:pb-10"
                  >
                    <div className="space-y-2">
                      <p className="sku-label text-white/55">Size</p>
                      <div
                        className="flex flex-wrap gap-2.5 sm:gap-3"
                        role="group"
                        aria-label={`Sizes for ${cat.label}`}
                      >
                        {cat.sizes.map((s) => {
                          const isOn = selected.has(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSize(cat.key, s)}
                              aria-pressed={isOn}
                              className={
                                CHIP_BASE +
                                " " +
                                CHIP_SIZE +
                                " " +
                                (isOn ? CHIP_ON : CHIP_OFF)
                              }
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5 space-y-2 border-t border-white/10 pt-5">
                      <p className="sku-label text-white/55">Budget</p>
                      <div
                        className="flex flex-wrap gap-2.5 sm:gap-3"
                        role="group"
                        aria-label={`Budget for ${cat.label}`}
                      >
                        <button
                          type="button"
                          onClick={() => setBudget(cat.key, undefined)}
                          aria-pressed={budgetMax == null}
                          className={
                            CHIP_BASE +
                            " " +
                            CHIP_BUDGET +
                            " " +
                            (budgetMax == null ? CHIP_ON : CHIP_OFF)
                          }
                        >
                          None
                        </button>
                        {BUDGET_TIERS_USD.map((n) => {
                          const isOn =
                            budgetMax != null && Number(budgetMax) === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setBudget(cat.key, n)}
                              aria-pressed={isOn}
                              className={
                                CHIP_BASE +
                                " " +
                                CHIP_BUDGET +
                                " " +
                                (isOn ? CHIP_ON : CHIP_OFF)
                              }
                            >
                              ≤${n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
