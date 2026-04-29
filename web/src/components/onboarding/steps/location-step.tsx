"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isLocationFieldsComplete } from "@/lib/profile/completion";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
] as const;

function flagEmoji(countryCode: string): string {
  // Regional indicator symbols
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  const a = 0x1f1e6;
  const first = code.charCodeAt(0) - 65 + a;
  const second = code.charCodeAt(1) - 65 + a;
  return String.fromCodePoint(first, second);
}

export function LocationStep({
  initialCountry,
  onStepCompleteChange,
  /** Use under Profile “Personal Information” (smaller title, less duplicate chrome). */
  embedded = false,
  /** Fires when a location PATCH starts/finishes (for a unified “Saving…” in profile). */
  onLocationSavingStateChange,
}: {
  initialCountry: string | null;
  onStepCompleteChange?: (complete: boolean) => void;
  embedded?: boolean;
  onLocationSavingStateChange?: (saving: boolean) => void;
}) {
  const suggested = useMemo(() => initialCountry ?? "US", [initialCountry]);
  const [country, setCountry] = useState(suggested);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locationSkipFirstAuto = useRef(embedded);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onLocationSavingStateChange?.(saving);
  }, [saving, onLocationSavingStateChange]);

  useEffect(() => {
    onStepCompleteChange?.(
      isLocationFieldsComplete({ country, address1, city, postal }),
    );
  }, [country, address1, city, postal, onStepCompleteChange]);

  useEffect(() => {
    setCountry(suggested);
    // Pull saved location from profile when entering this step.
    void (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        const json = (await res.json()) as { location?: unknown };
        const loc = json.location;
        if (loc && typeof loc === "object" && !Array.isArray(loc)) {
          const o = loc as Record<string, unknown>;
          setCountry(
            typeof o.country === "string" ? o.country : suggested,
          );
          setAddress1(typeof o.address1 === "string" ? o.address1 : "");
          setAddress2(typeof o.address2 === "string" ? o.address2 : "");
          setCity(typeof o.city === "string" ? o.city : "");
          setRegion(typeof o.region === "string" ? o.region : "");
          setPostal(typeof o.postal === "string" ? o.postal : "");
          setConfirmed(
            Boolean(
              typeof o.country === "string" &&
                o.country.trim() &&
                typeof o.address1 === "string" &&
                o.address1.trim() &&
                typeof o.city === "string" &&
                o.city.trim() &&
                typeof o.postal === "string" &&
                o.postal.trim(),
            ),
          );
        } else {
          setConfirmed(Boolean(initialCountry));
        }
      } catch {
        setConfirmed(Boolean(initialCountry));
      }
    })();
  }, [suggested, initialCountry]);

  useEffect(() => {
    if (!embedded) return;
    if (locationSkipFirstAuto.current) {
      locationSkipFirstAuto.current = false;
      return;
    }
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
    }
    autoTimer.current = setTimeout(() => {
      void (async () => {
        if (!isLocationFieldsComplete({ country, address1, city, postal })) {
          return;
        }
        setErr(null);
        setSaving(true);
        try {
          const res = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              location: {
                country,
                address1,
                address2: address2.trim() ? address2.trim() : null,
                city,
                region: region.trim() ? region.trim() : null,
                postal,
              },
            }),
          });
          const j = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(j.error ?? "Save failed");
          setConfirmed(true);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Save failed");
        } finally {
          setSaving(false);
        }
      })();
    }, 700);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [embedded, country, address1, address2, city, region, postal]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          location: {
            country,
            address1,
            address2: address2.trim() ? address2.trim() : null,
            city,
            region: region.trim() ? region.trim() : null,
            postal,
          },
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setConfirmed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (embedded) {
    return (
      <div className="space-y-3 sm:col-span-2">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1.5 text-sm sm:max-w-md">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Country
            </span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] outline-none focus:border-white/20 focus:ring-2 focus:ring-white/20"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="text-neutral-900">
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Street address
            </span>
            <input
              value={address1}
              onChange={(e) => {
                setAddress1(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="Street number and name"
              autoComplete="address-line1"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Address line 2 (optional)
            </span>
            <input
              value={address2}
              onChange={(e) => {
                setAddress2(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="Apartment, suite, building, etc."
              autoComplete="address-line2"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm sm:max-w-md">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              City
            </span>
            <input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="City or town"
              autoComplete="address-level2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                State / province / region
              </span>
              <input
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setConfirmed(false);
                }}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
                placeholder="Optional (required in some countries)"
                autoComplete="address-level1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Postal / ZIP code
              </span>
              <input
                value={postal}
                onChange={(e) => {
                  setPostal(e.target.value);
                  setConfirmed(false);
                }}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
                placeholder="e.g. 94103"
                autoComplete="postal-code"
              />
            </label>
          </div>
        </div>

        {err ? (
          <p className="text-sm text-red-300" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Location</h2>
          <p className="mt-1 text-sm text-white/60">
            Used to format currency and improve shop availability context.
          </p>
        </div>
        <div className="text-xs text-white/55">
          {saving ? "Saving…" : confirmed ? "Saved" : "Not saved yet"}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {flagEmoji(country)}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                {confirmed ? "Saved address" : "Add your location"}
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                Country and street first, then city and postal.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1.5 text-sm sm:max-w-md">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Country
            </span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] outline-none focus:border-white/20 focus:ring-2 focus:ring-white/20"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="text-neutral-900">
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Street address
            </span>
            <input
              value={address1}
              onChange={(e) => {
                setAddress1(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="Street number and name"
              autoComplete="address-line1"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              Address line 2 (optional)
            </span>
            <input
              value={address2}
              onChange={(e) => {
                setAddress2(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="Apartment, suite, building, etc."
              autoComplete="address-line2"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm sm:max-w-md">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
              City
            </span>
            <input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setConfirmed(false);
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
              placeholder="City or town"
              autoComplete="address-level2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                State / province / region
              </span>
              <input
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setConfirmed(false);
                }}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
                placeholder="Optional (required in some countries)"
                autoComplete="address-level1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                Postal / ZIP code
              </span>
              <input
                value={postal}
                onChange={(e) => {
                  setPostal(e.target.value);
                  setConfirmed(false);
                }}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/20"
                placeholder="e.g. 94103"
                autoComplete="postal-code"
              />
            </label>
          </div>
        </div>

        {err ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </div>
  );
}

