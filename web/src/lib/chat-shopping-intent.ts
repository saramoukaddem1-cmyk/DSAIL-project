import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import {
  extractMaxUsdFromText,
  rollForwardBudgetCapFromThread,
} from "@/lib/chat-price-parse";
import { buildChatTranscript } from "@/lib/chat-thread";
import type { StylePassport, WardrobeCategoryKey } from "@/types/style-passport";

export type RawChatShoppingIntent = {
  searchTerm: string;
  assistantBrief: string;
  maxProducts: number;
  /** Explicit max price in USD when the user states a cap (e.g. "under $200"). */
  maxPriceUsd: number | null;
  colorHints: string[];
  categoryHints: string[];
  sizeHints: string[];
  /** True only when the user clearly wants results limited to saved portfolio brands. */
  onlyPortfolioBrands: boolean;
  /** User wants a wider brand mix — do not overweight saved brands. */
  ignorePortfolioBoost: boolean;
  /** Short suggested follow-ups (3–6 words each). */
  followUpChips: string[];
  /** Designer / house names the user asked for (lowercase ok). */
  brandHints: string[];
  /** Fabrics, fit, occasion, silhouette — matched to name/category/description. */
  detailHints: string[];
};

export type MergedChatShoppingPlan = {
  searchTerm: string;
  assistantBrief: string;
  maxProducts: number;
  maxUsd: number | undefined;
  /** Hard filter: colors the user (or heuristic) asked for only. */
  colorKeywords: string[];
  /** Soft boost: palette from passport when user did not specify colors. */
  boostColorKeywords: string[];
  categorySubstrings: string[];
  brandKeywords: string[];
  detailKeywords: string[];
  sizeTokens: string[];
  portfolioOnly: boolean;
  /** When true and portfolio non-empty, rank and interleave saved brands heavily. */
  preferPortfolioBoost: boolean;
  followUpChips: string[];
  /** One-line description of active filters for UI / copy. */
  constraintSummary: string;
};

function inferWardrobeBudgetKey(
  hints: string[],
  searchTerm: string,
): WardrobeCategoryKey | undefined {
  const blob = `${hints.join(" ")} ${searchTerm}`.toLowerCase();
  if (/\b(dress|dresses|gown|midi|maxi)\b/.test(blob)) return "dresses";
  if (/\b(top|tee|shirt|blouse|tank|sweater|cardigan|hoodie)\b/.test(blob))
    return "tops";
  if (/\b(jean|denim)\b/.test(blob)) return "jeans";
  if (/\b(pant|pants|trouser)\b/.test(blob)) return "pants";
  if (/\bshorts?\b/.test(blob)) return "shorts";
  if (/\bskirt\b/.test(blob)) return "skirts";
  if (/\b(swim|bikini|one[\s-]?piece)\b/.test(blob)) return "swim";
  if (/\b(shoe|sneaker|heel|boot|sandal|flats?)\b/.test(blob)) return "shoes";
  if (/\b(jacket|coat|blazer|outerwear)\b/.test(blob)) return "outerwear";
  if (/\b(jumpsuit|romper)\b/.test(blob)) return "jumpsuits";
  return undefined;
}

function resolveMaxUsd(
  fromModel: number | null | undefined,
  lastUserExplicitUsd: number | undefined,
  threadRolledUsd: number | undefined,
  passport: StylePassport,
  hints: string[],
  searchTerm: string,
): number | undefined {
  const fromModelOk =
    fromModel != null && Number.isFinite(fromModel) && fromModel > 0
      ? Math.round(fromModel * 100) / 100
      : undefined;
  const explicit = lastUserExplicitUsd;
  const rolled = threadRolledUsd;
  let chosen =
    explicit ?? fromModelOk ?? (rolled != null && rolled > 0 ? rolled : undefined);

  if (chosen == null) {
    const key = inferWardrobeBudgetKey(hints, searchTerm);
    const wb = key ? passport.wardrobe?.[key]?.budgetMax : undefined;
    if (wb != null && Number.isFinite(wb) && wb > 0) chosen = wb;
  }
  if (chosen == null) {
    if (
      passport.budgetMax != null &&
      Number.isFinite(passport.budgetMax) &&
      passport.budgetMax > 0
    ) {
      chosen = passport.budgetMax;
    }
  }
  return chosen;
}

function normalizeHintTokens(arr: string[]): string[] {
  const set = new Set<string>();
  for (const x of arr) {
    const t = x.trim().toLowerCase();
    if (t.length >= 2) set.add(t);
  }
  return [...set];
}

function resolveSizeTokens(
  fromModel: string[],
  passport: StylePassport,
  hints: string[],
  searchTerm: string,
): string[] {
  const cleaned = fromModel.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length) return cleaned;
  const key = inferWardrobeBudgetKey(hints, searchTerm);
  const fromPass = key ? passport.wardrobe?.[key]?.sizes : undefined;
  if (fromPass?.length) return [...fromPass];
  return [];
}

function userColorKeywords(fromModel: string[]): string[] {
  const set = new Set<string>();
  for (const c of fromModel) {
    const t = c.trim().toLowerCase();
    if (t) set.add(t);
  }
  return [...set];
}

function passportBoostColors(passport: StylePassport): string[] {
  const set = new Set<string>();
  for (const c of passport.colors ?? []) {
    const t = String(c).trim().toLowerCase();
    if (t) set.add(t);
  }
  return [...set];
}

function deriveCategorySubstrings(
  fromModel: string[],
  searchTerm: string,
): string[] {
  const set = new Set<string>();
  for (const h of fromModel) {
    const t = h.trim().toLowerCase();
    if (t.length >= 2) set.add(t);
  }
  const st = searchTerm;
  const rules: { token: string; re: RegExp }[] = [
    { token: "dress", re: /\bdress(?:es)?\b/i },
    { token: "top", re: /\b(tops?|tee|shirt|blouse)\b/i },
    { token: "skirt", re: /\bskirts?\b/i },
    { token: "jean", re: /\bjeans?\b/i },
    { token: "pant", re: /\bpants?\b|trousers?\b/i },
    { token: "short", re: /\bshorts?\b/i },
    { token: "blazer", re: /\bblazers?\b/i },
    { token: "jacket", re: /\bjackets?\b/i },
    { token: "coat", re: /\bcoats?\b/i },
    { token: "sneaker", re: /\bsneakers?\b/i },
    { token: "boot", re: /\bboots?\b/i },
    { token: "heel", re: /\bheels?\b/i },
    { token: "swim", re: /\bswim|bikini|one[\s-]?piece\b/i },
    { token: "jumpsuit", re: /\bjumpsuits?\b|rompers?\b/i },
  ];
  for (const { token, re } of rules) {
    if (re.test(st)) set.add(token);
  }
  return [...set];
}

function buildConstraintSummary(plan: Omit<MergedChatShoppingPlan, "constraintSummary">): string {
  const parts: string[] = [];
  if (plan.colorKeywords.length) {
    parts.push(
      plan.colorKeywords
        .slice(0, 4)
        .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
        .join(", "),
    );
  } else if (plan.boostColorKeywords.length) {
    parts.push(
      `palette lean: ${plan.boostColorKeywords
        .slice(0, 3)
        .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
        .join(", ")}`,
    );
  }
  if (plan.maxUsd != null) {
    parts.push(`max $${plan.maxUsd % 1 === 0 ? plan.maxUsd.toFixed(0) : plan.maxUsd.toFixed(2)}`);
  }
  if (plan.sizeTokens.length) {
    parts.push(`sizes ${plan.sizeTokens.slice(0, 6).join(", ")}`);
  }
  if (plan.categorySubstrings.length) {
    parts.push(plan.categorySubstrings.slice(0, 3).join(" · "));
  }
  if (plan.brandKeywords.length) {
    parts.push(
      `brands ${plan.brandKeywords
        .slice(0, 3)
        .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
        .join(", ")}`,
    );
  }
  if (plan.detailKeywords.length) {
    parts.push(plan.detailKeywords.slice(0, 4).join(" · "));
  }
  if (plan.portfolioOnly) {
    parts.push("your brands only");
  } else if (plan.preferPortfolioBoost) {
    parts.push("your saved brands prioritized");
  }
  return parts.length ? parts.join(" · ") : "Your style passport + search";
}

export function mergeChatShoppingIntent(
  raw: RawChatShoppingIntent,
  passport: StylePassport,
  pricing: {
    lastUserExplicitUsd: number | undefined;
    threadRolledUsd: number | undefined;
  },
  portfolioBrandCount: number,
  opts?: { userOptedOutPortfolioBoost?: boolean },
): MergedChatShoppingPlan {
  const searchTerm = raw.searchTerm.trim() || "fashion";
  const assistantBrief = raw.assistantBrief.trim() || "Here are some picks.";
  const maxProducts = Math.min(16, Math.max(4, Math.round(raw.maxProducts)));

  const categorySubstrings = deriveCategorySubstrings(
    raw.categoryHints,
    searchTerm,
  );
  const maxUsd = resolveMaxUsd(
    raw.maxPriceUsd,
    pricing.lastUserExplicitUsd,
    pricing.threadRolledUsd,
    passport,
    raw.categoryHints,
    searchTerm,
  );
  const sizeTokens = resolveSizeTokens(
    raw.sizeHints,
    passport,
    raw.categoryHints,
    searchTerm,
  );
  const colorKeywords = userColorKeywords(raw.colorHints);
  const boostColorKeywords =
    colorKeywords.length > 0 ? [] : passportBoostColors(passport);
  const brandKeywords = normalizeHintTokens(raw.brandHints ?? []);
  const detailKeywords = normalizeHintTokens(raw.detailHints ?? []);
  const portfolioOnly = Boolean(raw.onlyPortfolioBrands);
  // Do not let the model turn off brand priority — only explicit user phrasing (heuristic).
  const preferPortfolioBoost =
    portfolioBrandCount > 0 &&
    !portfolioOnly &&
    opts?.userOptedOutPortfolioBoost !== true;

  const chips = (raw.followUpChips ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  const plan: Omit<MergedChatShoppingPlan, "constraintSummary"> = {
    searchTerm,
    assistantBrief,
    maxProducts,
    maxUsd,
    colorKeywords,
    boostColorKeywords,
    categorySubstrings,
    brandKeywords,
    detailKeywords,
    sizeTokens,
    portfolioOnly,
    preferPortfolioBoost,
    followUpChips: chips,
  };

  const constraintSummary = buildConstraintSummary(plan);

  return { ...plan, constraintSummary };
}

const HEURISTIC_COLORS = [
  "red",
  "blue",
  "black",
  "white",
  "green",
  "pink",
  "yellow",
  "navy",
  "brown",
  "beige",
  "ivory",
  "purple",
  "orange",
  "grey",
  "gray",
  "cream",
  "burgundy",
  "camel",
  "tan",
  "wine",
  "coral",
  "mint",
  "lavender",
] as const;

/** When Gemini is unavailable, pull obvious price/size/color cues from the message. */
export function heuristicShoppingIntentPatch(message: string): Partial<RawChatShoppingIntent> {
  const m = message;
  const out: Partial<RawChatShoppingIntent> = {};

  const parsed = extractMaxUsdFromText(m);
  if (parsed != null) out.maxPriceUsd = parsed;

  const sizeMatch = m.match(
    /\bsize\s+(xxs|xs|s|m|l|xl|xxl|\d+(?:\.\d+)?)\b/i,
  );
  if (sizeMatch) {
    out.sizeHints = [sizeMatch[1]!];
  }

  const hints: string[] = [];
  for (const c of HEURISTIC_COLORS) {
    if (new RegExp(`\\b${c}\\b`, "i").test(m)) hints.push(c);
  }
  if (hints.length) out.colorHints = hints;

  if (/\bonly\s+(my|our)\s+brands?\b/i.test(m) || /\bfrom\s+my\s+brands?\b/i.test(m)) {
    out.onlyPortfolioBrands = true;
  }

  if (
    /\b(any brand|every brand|open to any|don'?t care (about )?brand|brand doesn'?t matter)\b/i.test(
      m,
    )
  ) {
    out.ignorePortfolioBoost = true;
  }

  return out;
}

function defaultFollowUpChips(
  portfolioBrandCount: number,
): string[] {
  const out = [
    "Show cheaper picks",
    "Try a different color",
    "More like this",
  ];
  if (portfolioBrandCount > 0) {
    out.splice(1, 0, "Only my saved brands");
  }
  return out;
}

export async function extractChatShoppingIntent(
  lastUser: string,
  options: {
    apiKey: string;
    modelName?: string;
    portfolioBrands: string[];
    passport: StylePassport;
    messages: { role: string; content: string }[];
  },
): Promise<MergedChatShoppingPlan> {
  const portfolioLine = options.portfolioBrands.length
    ? `Saved brands (portfolio) — prioritize these when ranking unless the user opts out: ${options.portfolioBrands.join(", ")}.`
    : "No saved brands yet.";

  const passportJson = JSON.stringify(options.passport, null, 2);
  const transcript = buildChatTranscript(options.messages);

  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: options.modelName ?? "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          searchTerm: {
            type: SchemaType.STRING,
            description:
              "Short catalog keywords, e.g. women red midi dress, black blazer",
          },
          assistantBrief: {
            type: SchemaType.STRING,
            description:
              "One warm sentence; reference the thread when the user refines (e.g. color swap, cheaper).",
          },
          maxProducts: {
            type: SchemaType.INTEGER,
            description: "How many products to show, 4–16",
          },
          maxPriceUsd: {
            type: SchemaType.NUMBER,
            description:
              "Numeric USD cap when ANY user turn states a budget (convert £ € to USD roughly: £×1.27, €×1.08); else null",
            nullable: true,
          },
          colorHints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Lowercase color words from the user only; empty if none",
          },
          categoryHints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Garment words: dress, top, jeans, skirt, shoes, etc.; empty if vague",
          },
          sizeHints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Sizes from the user: S, M, 4, 8, etc.; empty if not stated",
          },
          onlyPortfolioBrands: {
            type: SchemaType.BOOLEAN,
            description:
              "True only if they explicitly want ONLY saved portfolio brands",
          },
          ignorePortfolioBoost: {
            type: SchemaType.BOOLEAN,
            description:
              "True if they want any brand / do not prioritize saved brands",
          },
          followUpChips: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Exactly 4 short next-step phrases (max 6 words each), conversational",
          },
          brandHints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Designer/brand names the user wants (as they said them); empty if none",
          },
          detailHints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "Style/material/occasion tokens: lace, linen, mini, wedding, casual, sleeveless, etc.; empty if none",
          },
        },
        required: [
          "searchTerm",
          "assistantBrief",
          "maxProducts",
          "colorHints",
          "categoryHints",
          "sizeHints",
          "onlyPortfolioBrands",
          "ignorePortfolioBoost",
          "followUpChips",
          "brandHints",
          "detailHints",
        ],
      },
    },
    systemInstruction: `You extract structured shopping intent from multi-turn fashion shopping chat.
The transcript is chronological. The LATEST user message is the active request; earlier turns supply budget, size, garment type, and color unless superseded.

Rules:
- searchTerm: concise catalog keywords; carry forward garment type from earlier turns if the latest message is a short refinement ("cheaper", "in navy", "size M").
- maxPriceUsd: use the effective budget from the conversation in USD. If they said £ or €, convert approximately (£×1.27, €×1.08). If the latest message does not repeat a budget but earlier turns did, still output that numeric cap. If unsure, null.
- colorHints: colors from user wording only (latest or carried forward if they say "same but red").
- categoryHints: inferred garment/category; use full thread.
- sizeHints: from any user turn unless contradicted.
- onlyPortfolioBrands: true ONLY for explicit "only my brands" / "just brands I saved".
- ignorePortfolioBoost: true if they clearly want any brand / brand does not matter.
- followUpChips: exactly 4 useful next steps (e.g. cheaper, different color, only my brands, more formal).
- brandHints: designer names if the user asked for a label (e.g. Bardot, Lioness); empty otherwise.
- detailHints: fabrics, fit, occasion, silhouette, neckline, etc. from the thread; matched to product descriptions and titles.
${portfolioLine}
User style passport (JSON):
${passportJson}`,
  });

  const userPayload = `Conversation transcript:\n${transcript || "(empty)"}\n\n---\nLatest user message (primary):\n${lastUser.slice(0, 4000)}`;

  const result = await model.generateContent(userPayload.slice(0, 24_000));
  const text = result.response.text();
  const parsed = JSON.parse(text) as Record<string, unknown>;

  const raw: RawChatShoppingIntent = {
    searchTerm: String(parsed.searchTerm ?? "").trim(),
    assistantBrief: String(parsed.assistantBrief ?? "").trim(),
    maxProducts: Number(parsed.maxProducts),
    maxPriceUsd:
      parsed.maxPriceUsd == null || parsed.maxPriceUsd === ""
        ? null
        : Number(parsed.maxPriceUsd),
    colorHints: Array.isArray(parsed.colorHints)
      ? parsed.colorHints.map((x) => String(x).trim()).filter(Boolean)
      : [],
    categoryHints: Array.isArray(parsed.categoryHints)
      ? parsed.categoryHints.map((x) => String(x).trim()).filter(Boolean)
      : [],
    sizeHints: Array.isArray(parsed.sizeHints)
      ? parsed.sizeHints.map((x) => String(x).trim()).filter(Boolean)
      : [],
    onlyPortfolioBrands: Boolean(parsed.onlyPortfolioBrands),
    ignorePortfolioBoost: Boolean(parsed.ignorePortfolioBoost),
    followUpChips: Array.isArray(parsed.followUpChips)
      ? parsed.followUpChips.map((x) => String(x).trim()).filter(Boolean)
      : [],
    brandHints: Array.isArray(parsed.brandHints)
      ? parsed.brandHints.map((x) => String(x).trim()).filter(Boolean)
      : [],
    detailHints: Array.isArray(parsed.detailHints)
      ? parsed.detailHints.map((x) => String(x).trim()).filter(Boolean)
      : [],
  };

  if (!Number.isFinite(raw.maxProducts)) raw.maxProducts = 12;
  if (raw.maxPriceUsd != null && !Number.isFinite(raw.maxPriceUsd)) {
    raw.maxPriceUsd = null;
  }

  const heuristic = heuristicShoppingIntentPatch(lastUser);
  if (heuristic.maxPriceUsd != null) raw.maxPriceUsd = heuristic.maxPriceUsd;
  if (heuristic.sizeHints?.length) raw.sizeHints = heuristic.sizeHints;
  if (heuristic.colorHints?.length) {
    raw.colorHints = [
      ...new Set([...raw.colorHints, ...heuristic.colorHints]),
    ];
  }
  if (heuristic.onlyPortfolioBrands) raw.onlyPortfolioBrands = true;
  if (heuristic.ignorePortfolioBoost) raw.ignorePortfolioBoost = true;

  const threadRolledUsd = rollForwardBudgetCapFromThread(options.messages);
  const lastUserExplicitUsd = extractMaxUsdFromText(lastUser);

  const merged = mergeChatShoppingIntent(
    raw,
    options.passport,
    { lastUserExplicitUsd, threadRolledUsd },
    options.portfolioBrands.length,
    { userOptedOutPortfolioBoost: heuristic.ignorePortfolioBoost === true },
  );

  if (!merged.followUpChips.length) {
    merged.followUpChips = defaultFollowUpChips(options.portfolioBrands.length);
  }
  return merged;
}

export function planFromHeuristicOnly(
  messages: { role: string; content: string }[],
  passport: StylePassport,
  portfolioBrandCount: number,
): MergedChatShoppingPlan {
  let lastUser = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      lastUser = messages[i]!.content.trim();
      break;
    }
  }
  const slice = lastUser.slice(0, 200).trim() || "fashion";
  const patch = heuristicShoppingIntentPatch(lastUser);
  const threadRolledUsd = rollForwardBudgetCapFromThread(messages);
  const lastUserExplicitUsd = extractMaxUsdFromText(lastUser);

  const raw: RawChatShoppingIntent = {
    searchTerm: slice,
    assistantBrief: "Here are some pieces we found.",
    maxProducts: 12,
    maxPriceUsd: patch.maxPriceUsd ?? null,
    colorHints: patch.colorHints ?? [],
    categoryHints: [],
    sizeHints: patch.sizeHints ?? [],
    onlyPortfolioBrands: patch.onlyPortfolioBrands ?? false,
    ignorePortfolioBoost: patch.ignorePortfolioBoost ?? false,
    followUpChips: [],
    brandHints: [],
    detailHints: [],
  };
  const merged = mergeChatShoppingIntent(
    raw,
    passport,
    { lastUserExplicitUsd, threadRolledUsd },
    portfolioBrandCount,
    { userOptedOutPortfolioBoost: patch.ignorePortfolioBoost === true },
  );
  if (!merged.followUpChips.length) {
    merged.followUpChips = defaultFollowUpChips(portfolioBrandCount);
  }
  return merged;
}
