"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  formatPhoneForStore,
  parseStoredPhone,
  PHONE_DIAL_CODES,
} from "@/lib/phone-dial-codes";
import type { StylePassport } from "@/types/style-passport";
import { LocationStep } from "@/components/onboarding/steps/location-step";
import { BrandPreferencesStep } from "@/components/onboarding/steps/brand-preferences-step";
import { SizesBudgetForm } from "@/components/profile/sizes-budget-form";
import { ProfileSaveIndicator } from "@/components/profile/profile-save-indicator";

const PROFILE_PANEL =
  "relative rounded-2xl border border-white/10 bg-white/5 p-6";

type TabId = "account" | "sizes" | "brands";

export function ProfileTabs({
  initial,
}: {
  initial: {
    displayName: string;
    email: string;
    phone: string;
    passport: StylePassport;
    location_country: string | null;
    portfolioBrands: string[];
  };
}) {
  const [tab, setTab] = useState<TabId>("account");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const initialPhone = useMemo(
    () => parseStoredPhone(initial.phone),
    [initial.phone],
  );
  const [phoneDial, setPhoneDial] = useState(initialPhone.code);
  const [phoneNational, setPhoneNational] = useState(initialPhone.national);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locSaving, setLocSaving] = useState(false);
  const [sizesAutosave, setSizesAutosave] = useState<{
    saving: boolean;
    err: string | null;
  }>({ saving: false, err: null });
  const accountSaveSkipFirst = useRef(true);
  const accountSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (accountSaveSkipFirst.current) {
      accountSaveSkipFirst.current = false;
      return;
    }
    if (accountSaveTimer.current) {
      clearTimeout(accountSaveTimer.current);
    }
    accountSaveTimer.current = setTimeout(() => {
      void (async () => {
        setAccountError(null);
        setSaving(true);
        try {
          const phoneStored = formatPhoneForStore(phoneDial, phoneNational);
          const res = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              display_name: displayName,
              phone: phoneStored,
            }),
          });
          const j = (await res.json()) as { error?: string };
          if (!res.ok) {
            throw new Error(j.error ?? "Save failed");
          }
          setAccountError(null);
        } catch (err) {
          setAccountError(err instanceof Error ? err.message : "Error");
        } finally {
          setSaving(false);
        }
      })();
    }, 700);
    return () => {
      if (accountSaveTimer.current) {
        clearTimeout(accountSaveTimer.current);
      }
    };
  }, [displayName, phoneDial, phoneNational]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "sizes", label: "SKU Passport" },
    { id: "brands", label: "Brands" },
  ];

  return (
    <div className="min-w-0">
      <nav
        className="sku-tabs-row"
        style={
          {
            ["--tabs-cols" as never]: tabs.length,
          } as React.CSSProperties
        }
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={"sku-tab" + (tab === t.id ? " is-active" : "")}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
        <div
          className="sku-tabs-indicator"
          style={{
            // 0..3
            ["--tx" as never]: `calc(${tabs.findIndex((t) => t.id === tab)} * 100%)`,
          }}
          aria-hidden
        />
      </nav>

      <div className="mt-6 min-w-0">
        {tab === "account" ? (
          <div className={`${PROFILE_PANEL} space-y-5`}>
            <div className="absolute right-6 top-6 z-10">
              <ProfileSaveIndicator
                saving={saving || locSaving}
                error={accountError}
              />
            </div>
            <h2 className="profile-section-title max-w-[calc(100%-7rem)] pr-2">
              Personal Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2 sm:max-w-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Name
                </span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
              </label>
              <div className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Phone
                </span>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <select
                    value={phoneDial}
                    onChange={(e) => setPhoneDial(e.target.value)}
                    className="h-10 w-full shrink-0 rounded-xl border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 sm:max-w-[min(100%,14rem)]"
                  >
                    {PHONE_DIAL_CODES.map((d) => (
                      <option key={d.code} value={d.code} className="text-neutral-900">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={phoneNational}
                    onChange={(e) => setPhoneNational(e.target.value.replace(/[^\d\s\-().]/g, ""))}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Phone number"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                  />
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Email
                </span>
                <input
                  value={initial.email}
                  readOnly
                  className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/70"
                />
                <p className="mt-1 text-xs text-white/40">
                  To change your email, use Supabase account settings or contact
                  support
                </p>
              </label>

              <LocationStep
                initialCountry={initial.location_country}
                embedded
                onLocationSavingStateChange={setLocSaving}
              />
            </div>

            <div className="pt-2">
              <Link
                href="/settings/password"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wide text-white/85 transition hover:border-white/20 hover:bg-white/10"
              >
                Change password
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "sizes" ? (
          <div className={PROFILE_PANEL}>
            <div className="absolute right-6 top-6 z-10">
              <ProfileSaveIndicator
                saving={sizesAutosave.saving}
                error={sizesAutosave.err}
              />
            </div>
            <SizesBudgetForm
              initialPassport={initial.passport}
              compact
              suppressHeaderStatus
              onAutosaveStateChange={setSizesAutosave}
            />
          </div>
        ) : null}

        {tab === "brands" ? (
          <div className={PROFILE_PANEL}>
            <div className="absolute right-6 top-6 z-10">
              <ProfileSaveIndicator saving={false} error={null} />
            </div>
            <h2 className="profile-section-title max-w-[calc(100%-7rem)] pr-2">
              Favorite brands
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Tap hearts to add or remove brands
            </p>
            <div className="mt-4 max-h-[min(70dvh,720px)] overflow-y-auto pr-1">
              <BrandPreferencesStep
                initialBrands={initial.portfolioBrands}
                hidePageHeading
              />
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
