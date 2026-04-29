import type { CSSProperties } from "react";

export type PassportColorPreset = {
  /** Canonical value stored in `style_passport.colors` */
  label: string;
  /** Visual for the circular swatch */
  swatchStyle: CSSProperties;
  /** Optional ring (e.g. white swatch) */
  swatchClassName?: string;
};

/** Fixed palette — matches product COLOR picker (order: 5 columns × 6 rows, last row one item). */
export const PASSPORT_COLOR_PRESETS: PassportColorPreset[] = [
  { label: "Black", swatchStyle: { backgroundColor: "#0d0d0d" } },
  {
    label: "White",
    swatchStyle: { backgroundColor: "#ffffff" },
    swatchClassName: "ring-1 ring-neutral-300",
  },
  { label: "Blue", swatchStyle: { backgroundColor: "#1e40af" } },
  { label: "Brown", swatchStyle: { backgroundColor: "#78350f" } },
  { label: "Grey", swatchStyle: { backgroundColor: "#9ca3af" } },
  { label: "Green", swatchStyle: { backgroundColor: "#4d7c0f" } },
  { label: "Orange", swatchStyle: { backgroundColor: "#ea580c" } },
  { label: "Pink", swatchStyle: { backgroundColor: "#fbcfe8" } },
  { label: "Red", swatchStyle: { backgroundColor: "#dc2626" } },
  { label: "Purple", swatchStyle: { backgroundColor: "#7c3aed" } },
  { label: "Yellow", swatchStyle: { backgroundColor: "#facc15" } },
  { label: "Neutral", swatchStyle: { backgroundColor: "#d6c4b0" } },
  {
    label: "Animal Print",
    swatchStyle: {
      background:
        "radial-gradient(circle at 20% 30%, #3d2c1e 12%, transparent 13%), radial-gradient(circle at 70% 60%, #1a1208 10%, transparent 11%), radial-gradient(circle at 45% 80%, #5c4033 8%, transparent 9%), linear-gradient(135deg, #c4a574 0%, #8b6914 40%, #d4b896 100%)",
    },
  },
  {
    label: "Abstract",
    swatchStyle: {
      background:
        "linear-gradient(145deg, #1e3a5f 0%, #93c5fd 35%, #e2e8f0 60%, #64748b 100%)",
    },
  },
  {
    label: "Plaid",
    swatchStyle: {
      background:
        "repeating-linear-gradient(90deg, #171717 0px, #171717 4px, #404040 4px, #404040 8px), repeating-linear-gradient(0deg, #171717 0px, #171717 4px, #525252 4px, #525252 8px)",
      backgroundBlendMode: "multiply",
    },
  },
  {
    label: "Floral",
    swatchStyle: {
      background:
        "radial-gradient(circle at 30% 40%, #f9a8d4 0%, transparent 45%), radial-gradient(circle at 70% 30%, #86efac 0%, transparent 40%), linear-gradient(180deg, #fff 0%, #fef3c7 100%)",
    },
  },
  {
    label: "Ombre / Tie Dye",
    swatchStyle: {
      background:
        "conic-gradient(from 180deg at 50% 50%, #1d4ed8 0deg, #ef4444 120deg, #ffffff 240deg, #1d4ed8 360deg)",
    },
  },
  {
    label: "Stripes",
    swatchStyle: {
      background:
        "repeating-linear-gradient(90deg, #0a0a0a 0px, #0a0a0a 6px, #fafafa 6px, #fafafa 12px)",
    },
  },
  {
    label: "Paisley",
    swatchStyle: {
      background:
        "radial-gradient(ellipse at 40% 40%, #92400e 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, #d6c4a8 0%, transparent 45%), linear-gradient(135deg, #fefce8 0%, #a16207 100%)",
    },
  },
  {
    label: "Camo",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #3f6212 25%, transparent 25%), linear-gradient(225deg, #422006 50%, transparent 50%), linear-gradient(315deg, #57534e 75%, transparent 75%), #78716c",
      backgroundSize: "8px 8px, 10px 10px, 12px 12px, 100% 100%",
    },
  },
  {
    label: "Stars",
    swatchStyle: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "radial-gradient(#0a0a0a 1px, transparent 1px), radial-gradient(#0a0a0a 1px, transparent 1px)",
      backgroundSize: "12px 12px",
      backgroundPosition: "0 0, 6px 6px",
    },
    swatchClassName: "ring-1 ring-neutral-200",
  },
  {
    label: "Tropical",
    swatchStyle: {
      background:
        "radial-gradient(circle at 30% 50%, #ec4899 0%, transparent 35%), radial-gradient(circle at 60% 40%, #22c55e 0%, transparent 40%), linear-gradient(180deg, #0f172a 0%, #020617 100%)",
    },
  },
  {
    label: "Novelty",
    swatchStyle: {
      background:
        "radial-gradient(circle at 25% 35%, #dc2626 8%, transparent 9%), radial-gradient(circle at 75% 65%, #16a34a 10%, transparent 11%), linear-gradient(180deg, #fff 0%, #fef2f2 100%)",
    },
  },
  {
    label: "Polka Dots",
    swatchStyle: {
      backgroundColor: "#0a0a0a",
      backgroundImage: "radial-gradient(#fafafa 2px, transparent 2px)",
      backgroundSize: "10px 10px",
    },
  },
  {
    label: "Geometric",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #facc15 25%, transparent 25%), linear-gradient(225deg, #a855f7 25%, transparent 25%), linear-gradient(315deg, #ec4899 25%, transparent 25%), linear-gradient(45deg, #facc15 25%, transparent 25%)",
      backgroundSize: "16px 16px",
      backgroundColor: "#fafafa",
    },
  },
  {
    label: "Metallic",
    swatchStyle: {
      background:
        "conic-gradient(from 0deg at 50% 50%, #e5e7eb, #9ca3af, #f3f4f6, #6b7280, #e5e7eb)",
    },
  },
];

const LABEL_LOWER = new Map(
  PASSPORT_COLOR_PRESETS.map((p) => [p.label.toLowerCase(), p.label]),
);

/** Map legacy saved labels onto canonical preset labels when close enough. */
export function alignToColorPresets(saved: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of saved) {
    const t = raw.trim();
    if (!t) continue;
    const canon = LABEL_LOWER.get(t.toLowerCase()) ?? t;
    const key = canon.toLowerCase();
    if (seen.has(key)) continue;
    if (LABEL_LOWER.has(key)) {
      seen.add(key);
      out.push(LABEL_LOWER.get(key)!);
    }
  }
  return out;
}
