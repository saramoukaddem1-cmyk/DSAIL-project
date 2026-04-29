import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { StylePassport } from "@/types/style-passport";

export type ChatFilterKey =
  | "category"
  | "color"
  | "size"
  | "budget"
  | "brand"
  | "description";

export type ChatFilterState = Record<ChatFilterKey, string | null>;

export const BUDGET_TIERS = [
  "≤$50",
  "≤$100",
  "≤$150",
  "≤$200",
  "≤$250",
  "≤$300",
  "≤$400",
  "≤$500",
  "≤$600",
  "≤$700",
  "≤$800",
  "≤$900",
  "≤$1000",
] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];

export function defaultChatFilterState(): ChatFilterState {
  return {
    category: null,
    color: null,
    size: null,
    budget: null,
    brand: null,
    description: null,
  };
}

export function budgetTierToMaxUsd(tier: string | null | undefined): number | undefined {
  if (!tier) return undefined;
  const m = String(tier).match(/\$([0-9]+)\s*$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizeBudgetToTier(maxUsd: number | null | undefined): BudgetTier | null {
  if (maxUsd == null || !Number.isFinite(maxUsd) || maxUsd <= 0) return null;
  const tiers = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
  for (const t of tiers) {
    if (maxUsd <= t) return (`≤$${t}` as BudgetTier);
  }
  return "≤$1000";
}

function titleCase(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function cleanVal(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeCategory(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  const map: Record<string, string> = {
    dress: "Dresses",
    dresses: "Dresses",
    gown: "Dresses",
    tops: "Tops",
    top: "Tops",
    shirt: "Tops",
    blouse: "Tops",
    pants: "Pants",
    pant: "Pants",
    trousers: "Pants",
    jeans: "Jeans",
    jean: "Jeans",
    skirts: "Skirts",
    skirt: "Skirts",
    shoes: "Shoes",
    shoe: "Shoes",
    boots: "Shoes",
    heels: "Shoes",
    bags: "Bags",
    bag: "Bags",
    outerwear: "Outerwear",
    coat: "Outerwear",
    jacket: "Outerwear",
    blazer: "Outerwear",
  };
  return map[t] ?? titleCase(t);
}

function normalizeColor(v: string | null): string | null {
  if (!v) return null;
  return titleCase(v.toLowerCase());
}

function normalizeSize(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  const lc = t.toLowerCase();
  if (lc === "small") return "S";
  if (lc === "medium") return "M";
  if (lc === "large") return "L";
  if (lc === "extra small" || lc === "x-small" || lc === "xsmall") return "XS";
  if (lc === "extra extra small" || lc === "xx-small" || lc === "xxsmall") return "XXS";
  if (lc === "extra large" || lc === "x-large" || lc === "xlarge") return "XL";
  if (lc === "extra extra large" || lc === "xx-large" || lc === "xxlarge") return "XXL";
  if (/^(xxs|xs|s|m|l|xl|xxl)$/i.test(t)) return t.toUpperCase();
  return t;
}

function normalizeBudget(v: string | null): BudgetTier | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  // Accept tiers directly
  const direct = BUDGET_TIERS.find((x) => x.toLowerCase() === t.toLowerCase());
  if (direct) return direct;
  // Accept numeric dollars
  const m = t.match(/([0-9]{1,5})/);
  if (!m) return null;
  const n = Number(m[1]);
  return normalizeBudgetToTier(n);
}

export function heuristicExtractFiltersFromMessage(message: string): Partial<ChatFilterState> {
  const m = message.toLowerCase();
  const out: Partial<ChatFilterState> = {};

  // budget: $123 / under 200
  const budgetMatch =
    m.match(/\$\s*([0-9]{1,5})/) ??
    m.match(/\b(under|below|max)\s*\$?\s*([0-9]{1,5})\b/);
  if (budgetMatch) {
    const n = Number(budgetMatch[budgetMatch.length - 1]);
    if (Number.isFinite(n) && n > 0) out.budget = normalizeBudgetToTier(n);
  }

  // size: XS..XXL, "size small", or EU shoe size like 38
  const sizeMatch = m.match(/\b(xx?s|xs|s|m|l|xl|xxl)\b/i);
  if (sizeMatch) out.size = normalizeSize(sizeMatch[1] ?? null);
  const wordSize = m.match(/\bsize\s*(xxs|xs|s|small|m|medium|l|large|xl|xxl)\b/i);
  if (!out.size && wordSize) out.size = normalizeSize(wordSize[1] ?? null);
  const numSize = m.match(/\bsize\s*([0-9]{2})\b/);
  if (!out.size && numSize) out.size = normalizeSize(numSize[1] ?? null);

  // color: simple list
  const colorMatch = m.match(
    /\b(black|white|ivory|cream|beige|tan|brown|red|burgundy|maroon|pink|purple|violet|blue|navy|green|olive|yellow|gold|orange|silver|gray|grey|champagne)\b/,
  );
  if (colorMatch) out.color = normalizeColor(colorMatch[1] ?? null);

  // category: keyword map
  const catMatch = m.match(
    /\b(dress|dresses|gown|top|tops|shirt|blouse|pants|trousers|jeans|skirt|skirts|shoes|boots|heels|bag|bags|coat|jacket|blazer|outerwear)\b/,
  );
  if (catMatch) out.category = normalizeCategory(catMatch[1] ?? null);

  // description: keep the raw message (trimmed) as a fallback catch-all
  out.description = message.trim().slice(0, 140) || null;

  return out;
}

export function mergeFilterState(prev: ChatFilterState, next: Partial<ChatFilterState>): ChatFilterState {
  return {
    category: next.category !== undefined ? next.category : prev.category,
    color: next.color !== undefined ? next.color : prev.color,
    size: next.size !== undefined ? next.size : prev.size,
    budget: next.budget !== undefined ? next.budget : prev.budget,
    brand: next.brand !== undefined ? next.brand : prev.brand,
    description: next.description !== undefined ? next.description : prev.description,
  };
}

export function computeMissingFilters(args: {
  state: ChatFilterState;
  passport: StylePassport;
  portfolioBrands: string[];
}): ChatFilterKey[] {
  const { state, passport, portfolioBrands } = args;
  const catKey = state.category ? state.category.toLowerCase() : null;
  const wardrobe = passport.wardrobe ?? {};
  const wardrobeKeyMap: Record<string, keyof typeof wardrobe> = {
    dresses: "dresses",
    tops: "tops",
    skirts: "skirts",
    pants: "pants",
    jeans: "jeans",
    shoes: "shoes",
    outerwear: "outerwear",
  };
  const wk = catKey ? wardrobeKeyMap[catKey] : undefined;
  const hasDefaultSize = Boolean(wk && wardrobe[wk]?.sizes && wardrobe[wk]?.sizes?.length);
  const hasDefaultBudget = Boolean(
    wk && typeof wardrobe[wk]?.budgetMax === "number" && (wardrobe[wk]?.budgetMax ?? 0) > 0,
  ) || Boolean(typeof passport.budgetMax === "number" && (passport.budgetMax ?? 0) > 0);
  const hasSavedBrands =
    (portfolioBrands ?? []).length > 0 || (passport.brands ?? []).length > 0;

  const missing: ChatFilterKey[] = [];
  if (!state.size && !hasDefaultSize) missing.push("size");
  if (!state.budget && !hasDefaultBudget) missing.push("budget");
  if (!state.color) missing.push("color");
  if (!state.brand && !hasSavedBrands) missing.push("brand");
  if (!state.description) missing.push("description");
  return missing;
}

export async function extractChatFiltersWithGemini(args: {
  apiKey: string;
  modelName?: string;
  message: string;
  prevState: ChatFilterState;
  passport: StylePassport;
  portfolioBrands: string[];
}): Promise<{
  state: ChatFilterState;
  newlyExtracted: ChatFilterKey[];
  missing: ChatFilterKey[];
}> {
  const genai = new GoogleGenerativeAI(args.apiKey);
  const model = genai.getGenerativeModel({
    model: args.modelName ?? "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          state: {
            type: SchemaType.OBJECT,
            properties: {
              category: { type: SchemaType.STRING, nullable: true },
              color: { type: SchemaType.STRING, nullable: true },
              size: { type: SchemaType.STRING, nullable: true },
              budget: { type: SchemaType.STRING, nullable: true },
              brand: { type: SchemaType.STRING, nullable: true },
              description: { type: SchemaType.STRING, nullable: true },
            },
            required: ["category", "color", "size", "budget", "brand", "description"],
          },
          newlyExtracted: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["state", "newlyExtracted"],
      },
    },
  });

  const prompt = [
    "Extract filters from a fashion search query. Return ONLY valid JSON:",
    '{"category":null,"color":null,"size":null,"budget":null,"brand":null,"description":null}',
    "",
    `Current filters: ${JSON.stringify(args.prevState)}`,
    "",
    "Rules:",
    "- Keep existing values unless user explicitly changes them",
    "- Budget tiers: 50,100,150,200,250,300,400,500,600,700,800,900,1000 (format: ≤$X)",
    "- description = occasion/mood/fabric/style/vibe (internal)",
    "- Return ONLY JSON, no markdown, no explanation",
    "",
    `Query: ${args.message}`,
  ].join("\n");

  const res = await model.generateContent(prompt);
  const txt = res.response.text();
  const parsed = JSON.parse(txt) as {
    state: ChatFilterState;
    newlyExtracted: string[];
  };

  const rawState = parsed?.state ?? defaultChatFilterState();
  const next: ChatFilterState = {
    category: normalizeCategory(cleanVal(rawState.category)),
    color: normalizeColor(cleanVal(rawState.color)),
    size: normalizeSize(cleanVal(rawState.size)),
    budget: normalizeBudget(cleanVal(rawState.budget)) ?? null,
    brand: cleanVal(rawState.brand),
    description: cleanVal(rawState.description),
  };

  const newly = new Set<ChatFilterKey>();
  for (const k of parsed?.newlyExtracted ?? []) {
    const kk = String(k).trim().toLowerCase() as ChatFilterKey;
    if (
      ["category", "color", "size", "budget", "brand", "description"].includes(kk)
    )
      newly.add(kk);
  }

  const missing = computeMissingFilters({
    state: next,
    passport: args.passport,
    portfolioBrands: args.portfolioBrands,
  });

  return { state: next, newlyExtracted: [...newly], missing };
}

