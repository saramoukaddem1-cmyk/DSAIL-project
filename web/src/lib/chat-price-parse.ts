/**
 * Pull numeric price caps from free text (USD-first catalog; rough FX for £ / €).
 */

const GBP_TO_USD = 1.27;
const EUR_TO_USD = 1.08;

function toUsd(amount: number, currency: "USD" | "GBP" | "EUR"): number {
  if (currency === "GBP") return amount * GBP_TO_USD;
  if (currency === "EUR") return amount * EUR_TO_USD;
  return amount;
}

function parseNum(s: string): number | null {
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Extract the tightest plausible max-price cap from a block of text (whole thread OK).
 * Picks the minimum among all matches so overlapping rules don't explode the budget.
 */
export function extractMaxUsdFromText(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const caps: number[] = [];

  const pushUsd = (n: number) => {
    if (n > 0 && n < 500_000) caps.push(Math.round(n * 100) / 100);
  };

  // $200, usd 200, 200 dollars, USD: 200
  const dollarPatterns: RegExp[] = [
    /\$\s*([\d,]+(?:\.\d+)?)\b/g,
    /\b(?:usd|us\$)\s*[:.]?\s*([\d,]+(?:\.\d+)?)\b/gi,
    /\b([\d,]+(?:\.\d+)?)\s*(?:usd|dollars?|bucks)\b/gi,
  ];
  for (const re of dollarPatterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const n = parseNum(m[1]!);
      if (n != null) pushUsd(n);
    }
  }

  // £ / GBP
  for (const re of [
    /£\s*([\d,]+(?:\.\d+)?)\b/g,
    /\bgbp\s*[:.]?\s*([\d,]+(?:\.\d+)?)\b/gi,
    /\b([\d,]+(?:\.\d+)?)\s*pounds?\b/gi,
  ]) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const n = parseNum(m[1]!);
      if (n != null) pushUsd(toUsd(n, "GBP"));
    }
  }

  // € / EUR
  for (const re of [
    /€\s*([\d,]+(?:\.\d+)?)\b/g,
    /\beur(?:o)?s?\s*[:.]?\s*([\d,]+(?:\.\d+)?)\b/gi,
    /\b([\d,]+(?:\.\d+)?)\s*euros?\b/gi,
  ]) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const n = parseNum(m[1]!);
      if (n != null) pushUsd(toUsd(n, "EUR"));
    }
  }

  // "2k" → 2000 (USD)
  const kRe = /\$\s*([\d.]+)\s*k\b|\b([\d.]+)\s*k\s*(?:usd|dollars?|\$)?/gi;
  let km: RegExpExecArray | null;
  while ((km = kRe.exec(text)) !== null) {
    const raw = km[1] ?? km[2];
    if (!raw) continue;
    const n = parseNum(raw);
    if (n != null) pushUsd(n * 1000);
  }

  // "between $50 and $100" (high end as cap)
  for (const block of text.matchAll(
    /\bbetween\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:and|[-–])\s*\$?\s*([\d,]+(?:\.\d+)?)\b/gi,
  )) {
    const hi = parseNum(block[2]!);
    if (hi != null) pushUsd(hi);
  }

  // Qualifiers: under / below / less than / max / up to / at most / cap / budget / around / about
  // Note: users frequently typo "less then" instead of "less than". Treat it as "less than".
  const qualified = text.match(
    /\b(?:under|below|less than|less then|cheaper than|no more than|max(?:imum)?|up to|at most|cap(?:ped)? at|around|about|approx(?:imately)?|~)\s*(?:[£€$])?\s*([\d,]+(?:\.\d+)?)\s*(?:usd|gbp|eur|dollars?|bucks|pounds?|euros?)?\b/gi,
  );
  if (qualified) {
    for (const m of text.matchAll(
      /\b(?:under|below|less than|less then|cheaper than|no more than|max(?:imum)?|up to|at most|cap(?:ped)? at|around|about|approx(?:imately)?|~)\s*(?:[£€$])?\s*([\d,]+(?:\.\d+)?)\s*(usd|gbp|eur|dollars?|bucks|pounds?|euros?)?\b/gi,
    )) {
      const n = parseNum(m[1]!);
      if (n == null) continue;
      const unit = (m[2] ?? "").toLowerCase();
      if (unit.includes("pound")) pushUsd(toUsd(n, "GBP"));
      else if (unit.includes("eur") || unit.includes("euro"))
        pushUsd(toUsd(n, "EUR"));
      else pushUsd(n);
    }
  }

  // Bare "200" after under (already covered) — last resort: lines with only number + optional currency in fashion context
  if (!caps.length) {
    const bare = text.match(
      /\b(?:price|budget|spend)\s*(?:is|of|:)?\s*\$?\s*([\d,]+(?:\.\d+)?)\b/gi,
    );
    if (bare) {
      for (const m of text.matchAll(
        /\b(?:price|budget|spend)\s*(?:is|of|:)?\s*\$?\s*([\d,]+(?:\.\d+)?)\b/gi,
      )) {
        const n = parseNum(m[1]!);
        if (n != null) pushUsd(n);
      }
    }
  }

  if (!caps.length) return undefined;
  return Math.min(...caps);
}

/** If the user tightens budget conversationally, derive a new cap from the prior cap. */
export function adjustMaxUsdForContinuation(
  lastUser: string,
  previousMaxUsd: number | undefined,
): number | undefined {
  if (previousMaxUsd == null || !Number.isFinite(previousMaxUsd)) return undefined;
  const u = lastUser.toLowerCase();
  if (
    /\b(cheaper|less expensive|lower price|spend less|more affordable)\b/.test(u)
  ) {
    return Math.max(15, Math.round(previousMaxUsd * 0.72 * 100) / 100);
  }
  if (/\b(splurge|more expensive|higher end|can spend more)\b/.test(u)) {
    return Math.round(previousMaxUsd * 1.45 * 100) / 100;
  }
  return undefined;
}

/**
 * Walk user turns in order: explicit prices update the cap; words like "cheaper" tighten
 * the running cap so follow-ups ("in blue", "show more") keep the last budget.
 */
export function rollForwardBudgetCapFromThread(
  messages: { role: string; content: string }[],
): number | undefined {
  let cap: number | undefined;
  for (const m of messages) {
    if (m.role !== "user") continue;
    const stated = extractMaxUsdFromText(m.content);
    if (stated != null) cap = stated;
    const adj = adjustMaxUsdForContinuation(m.content, cap);
    if (adj != undefined) cap = adj;
  }
  return cap;
}
