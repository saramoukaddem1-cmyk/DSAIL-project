/** Common country / region calling codes for phone UI (dial + national number). */
export const PHONE_DIAL_CODES: { code: string; label: string }[] = [
  { code: "+1", label: "United States / Canada +1" },
  { code: "+44", label: "United Kingdom +44" },
  { code: "+33", label: "France +33" },
  { code: "+49", label: "Germany +49" },
  { code: "+39", label: "Italy +39" },
  { code: "+34", label: "Spain +34" },
  { code: "+31", label: "Netherlands +31" },
  { code: "+46", label: "Sweden +46" },
  { code: "+47", label: "Norway +47" },
  { code: "+45", label: "Denmark +45" },
  { code: "+41", label: "Switzerland +41" },
  { code: "+61", label: "Australia +61" },
  { code: "+64", label: "New Zealand +64" },
  { code: "+971", label: "United Arab Emirates +971" },
  { code: "+966", label: "Saudi Arabia +966" },
  { code: "+65", label: "Singapore +65" },
  { code: "+852", label: "Hong Kong +852" },
  { code: "+81", label: "Japan +81" },
  { code: "+82", label: "South Korea +82" },
  { code: "+86", label: "China +86" },
  { code: "+91", label: "India +91" },
  { code: "+55", label: "Brazil +55" },
  { code: "+52", label: "Mexico +52" },
];

const DIAL_SET = new Set(PHONE_DIAL_CODES.map((d) => d.code));

const SORTED_BY_LEN = [...PHONE_DIAL_CODES].sort(
  (a, b) => b.code.length - a.code.length,
);

/**
 * Parse a stored `profiles.phone` string into dial code + national digits.
 */
export function parseStoredPhone(
  raw: string | null | undefined,
): { code: string; national: string } {
  const s = (raw ?? "").trim();
  if (!s) return { code: "+1", national: "" };
  if (!s.startsWith("+")) {
    return { code: "+1", national: s.replace(/\D/g, "") };
  }
  const withSpace = s.match(/^(\+\d{1,4})\s+(.+)$/);
  if (withSpace) {
    const code = withSpace[1]!;
    const nat = withSpace[2]!.replace(/\D/g, "");
    return { code: DIAL_SET.has(code) ? code : "+1", national: nat };
  }
  for (const o of SORTED_BY_LEN) {
    if (s === o.code) {
      return { code: o.code, national: "" };
    }
    if (s.length > o.code.length && s.startsWith(o.code)) {
      return { code: o.code, national: s.slice(o.code.length).replace(/\D/g, "") };
    }
  }
  return { code: "+1", national: s.replace(/\D/g, "") };
}

/**
 * Format dial code + national digits for `profiles.phone`.
 */
export function formatPhoneForStore(code: string, nationalDigits: string): string | null {
  const n = nationalDigits.replace(/\D/g, "");
  if (!n && !code) return null;
  if (!n) return null;
  const c = DIAL_SET.has(code) ? code : "+1";
  return `${c} ${n}`.trim();
}
