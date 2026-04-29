"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StylePassport } from "@/types/style-passport";
import type { ProfileCompletion } from "@/lib/profile/completion";
import { SizesBudgetStep } from "@/components/onboarding/steps/sizes-budget-step";
import { LocationStep } from "@/components/onboarding/steps/location-step";
import { BrandPreferencesStep } from "@/components/onboarding/steps/brand-preferences-step";

type StepId = "sizes" | "location" | "brands";

const STEPS: { id: StepId; label: string; desc: string }[] = [
  {
    id: "sizes",
    label: "Preferred sizes & budgets",
    desc: "Fast rows, leave blank if you don’t shop it.",
  },
  { id: "location", label: "Location", desc: "Delivery answers depend on it." },
  { id: "brands", label: "Brands", desc: "Pick designers you love." },
];

export function OnboardingClient({
  initial,
  required = false,
}: {
  initial: {
    displayName: string;
    email: string;
    phone: string;
    passport: StylePassport;
    location_country: string | null;
    portfolioBrands: string[];
    completion: ProfileCompletion;
  };
  required?: boolean;
}) {
  const [activeStep, setActiveStep] = useState<StepId>(() => {
    if (!initial.completion.step1_sizes_budget) return "sizes";
    if (!initial.completion.step2_location) return "location";
    if (!initial.completion.step3_brands) return "brands";
    return "sizes";
  });

  const [stepDone, setStepDone] = useState<Record<StepId, boolean>>(() => ({
    sizes: initial.completion.step1_sizes_budget,
    location: initial.completion.step2_location,
    brands: initial.completion.step3_brands,
  }));

  useEffect(() => {
    setStepDone({
      sizes: initial.completion.step1_sizes_budget,
      location: initial.completion.step2_location,
      brands: initial.completion.step3_brands,
    });
  }, [
    initial.completion.step1_sizes_budget,
    initial.completion.step2_location,
    initial.completion.step3_brands,
  ]);

  const onSizesDone = useCallback((v: boolean) => {
    setStepDone((s) => (s.sizes === v ? s : { ...s, sizes: v }));
  }, []);
  const onLocationDone = useCallback((v: boolean) => {
    setStepDone((s) => (s.location === v ? s : { ...s, location: v }));
  }, []);
  const onBrandsDone = useCallback((v: boolean) => {
    setStepDone((s) => (s.brands === v ? s : { ...s, brands: v }));
  }, []);

  const done = useMemo(
    () => ({
      sizes: stepDone.sizes,
      location: stepDone.location,
      brands: stepDone.brands,
    }),
    [stepDone],
  );

  const allDone = done.sizes && done.location && done.brands;

  async function skipSetup() {
    if (required) return;
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ onboarding_dismissed_at: new Date().toISOString() }),
      });
    } catch {
      /* still navigate */
    }
    window.location.href = "/chat";
  }

  return (
    <div className="grid min-h-0 w-full max-w-6xl items-start gap-6 grid-cols-1 md:grid-cols-[minmax(260px,300px),minmax(0,1fr)] md:items-start">
      <aside className="order-1 w-full min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 md:sticky md:top-4 md:max-h-[calc(100dvh-6rem)] md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Setup steps
          </p>
          {required ? null : (
            <button
              type="button"
              onClick={() => void skipSetup()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/75 hover:bg-white/10"
              title="Skip onboarding"
            >
              Skip
            </button>
          )}
        </div>

        <div
          className="mt-4 space-y-2"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {STEPS.map((s, idx) => {
            const isActive = s.id === activeStep;
            const isDone = done[s.id];
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`onboarding-tab-${s.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveStep(s.id)}
                className={
                  "w-full rounded-xl border px-3 py-2.5 text-left transition " +
                  (isActive
                    ? "border-white/25 bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10")
                }
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={
                      "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                      (isDone
                        ? "bg-emerald-500/20 text-emerald-200"
                        : isActive
                          ? "bg-white/15 text-white"
                          : "bg-white/10 text-white/70")
                    }
                    aria-hidden
                  >
                    {isDone ? "✓" : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-white/55">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        className="order-2 min-w-0 overflow-x-auto"
        role="tabpanel"
        id="onboarding-step-panel"
        aria-labelledby={`onboarding-tab-${activeStep}`}
      >
        {activeStep === "sizes" ? (
          <SizesBudgetStep
            initialPassport={initial.passport}
            onStepCompleteChange={onSizesDone}
          />
        ) : null}
        {activeStep === "location" ? (
          <LocationStep
            initialCountry={initial.location_country}
            onStepCompleteChange={onLocationDone}
          />
        ) : null}
        {activeStep === "brands" ? (
          <BrandPreferencesStep
            initialBrands={initial.portfolioBrands}
            onStepCompleteChange={onBrandsDone}
          />
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          {required ? null : (
            <button
              type="button"
              onClick={() => void skipSetup()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            disabled={!allDone}
            onClick={() => {
              window.location.href = "/chat";
            }}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0b0014] transition hover:bg-white/90 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}

