import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractChatShoppingIntent,
  planFromHeuristicOnly,
} from "@/lib/chat-shopping-intent";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import { buildResponseSummary } from "@/lib/revolve/client-filters";
import {
  searchRevolveCatalogPage,
  type RevolveChatConstraints,
} from "@/lib/revolve/revolve-catalog";
import {
  defaultChatFilterState,
  extractChatFiltersWithGemini,
  budgetTierToMaxUsd,
  heuristicExtractFiltersFromMessage,
  type ChatFilterState,
} from "@/lib/chat-filter-state";

const QuerySchema = z.object({
  q: z.string().min(1).max(400),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(8).max(60).default(24),
  vision: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => (v === "0" ? false : true)),
  fast: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),
});

const FilterRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const BodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(8).max(60).default(24),
  vision: z.boolean().optional().default(true),
  /** When set, overrides strict filter dimensions; omitted keys = cleared. */
  filters: FilterRecordSchema.optional(),
  filter_state: z
    .object({
      category: z.string().nullable(),
      color: z.string().nullable(),
      size: z.string().nullable(),
      budget: z.string().nullable(),
      brand: z.string().nullable(),
      description: z.string().nullable(),
    })
    .nullable()
    .optional(),
  /** If true, do NOT run Gemini extraction (client provided state). */
  skip_extract: z.boolean().optional().default(false),
  /** If true, skip any slow/LLM steps for speed. */
  fast: z.boolean().optional().default(false),
});

async function buildConstraintsFromMessages(args: {
  messages: { role: string; content: string }[];
  passport: StylePassport;
  portfolioBrands: string[];
  vision: boolean;
  fast?: boolean;
}): Promise<{
  constraints: RevolveChatConstraints;
  query: string;
  constraintSummary: string;
}> {
  const lastUser =
    [...args.messages].reverse().find((m) => m.role === "user")?.content?.trim() ??
    "";
  const query = lastUser.slice(0, 400).trim();
  const fallbackPlan = planFromHeuristicOnly(
    args.messages,
    args.passport,
    args.portfolioBrands.length,
  );

  let plan = fallbackPlan;
  if (!args.fast && process.env.GEMINI_API_KEY?.trim()) {
    try {
      plan = await extractChatShoppingIntent(lastUser, {
        apiKey: process.env.GEMINI_API_KEY.trim(),
        modelName: process.env.GEMINI_MODEL,
        portfolioBrands: args.portfolioBrands,
        passport: args.passport,
        messages: args.messages,
      });
    } catch {
      plan = fallbackPlan;
    }
  }

  const constraints: RevolveChatConstraints = {
    maxUsd: plan.maxUsd,
    gender: args.passport.gender,
    colorKeywords: plan.colorKeywords,
    boostColorKeywords: plan.boostColorKeywords,
    sizeTokens: plan.sizeTokens,
    categorySubstrings: plan.categorySubstrings,
    brandKeywords: plan.brandKeywords,
    detailKeywords: plan.detailKeywords,
    portfolioBrandNames: args.portfolioBrands,
    portfolioOnly: plan.portfolioOnly,
    preferPortfolioBoost: plan.preferPortfolioBoost,
    disableVisionColor: args.vision === false,
  };

  return { constraints, query, constraintSummary: plan.constraintSummary };
}

function constraintsFromState(args: {
  state: ChatFilterState;
  passport: StylePassport;
  portfolioBrands: string[];
  vision: boolean;
}): { constraints: RevolveChatConstraints; query: string; constraintSummary: string } {
  const query = [
    args.state.color ?? "",
    args.state.category ?? "",
    args.state.brand ?? "",
    args.state.description ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  const maxUsd = budgetTierToMaxUsd(args.state.budget ?? undefined);
  const constraints: RevolveChatConstraints = {
    maxUsd,
    gender: args.passport.gender,
    colorKeywords: args.state.color ? [String(args.state.color).toLowerCase()] : [],
    boostColorKeywords:
      args.state.color ? [] : (args.passport.colors ?? []).map((c) => String(c).toLowerCase()),
    sizeTokens: args.state.size ? [String(args.state.size)] : [],
    categorySubstrings: args.state.category ? [String(args.state.category).toLowerCase()] : [],
    brandKeywords: args.state.brand ? [String(args.state.brand).toLowerCase()] : [],
    detailKeywords: args.state.description
      ? [String(args.state.description).toLowerCase()]
      : [],
    portfolioBrandNames: args.portfolioBrands,
    portfolioOnly: false,
    preferPortfolioBoost: true,
    disableVisionColor: args.vision === false,
  };

  const parts: string[] = [];
  if (args.state.category) parts.push(`CATEGORY: ${args.state.category}`);
  if (args.state.color) parts.push(`COLOR: ${args.state.color}`);
  if (args.state.size) parts.push(`SIZE: ${args.state.size}`);
  if (args.state.budget) parts.push(`BUDGET: ${args.state.budget}`);
  if (args.state.brand) parts.push(`BRAND: ${args.state.brand}`);
  if (args.state.description) parts.push(`DESCRIPTION: ${args.state.description}`);
  const constraintSummary = parts.join(" · ") || "Chat with SKU";

  return { constraints, query, constraintSummary };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    offset: searchParams.get("offset") ?? "0",
    limit: searchParams.get("limit") ?? "24",
    vision: searchParams.get("vision") ?? undefined,
    fast: searchParams.get("fast") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_passport")
    .eq("id", user.id)
    .maybeSingle();

  const portfolioRes = await supabase
    .from("user_brand_portfolio")
    .select("brand_name")
    .eq("user_id", user.id)
    .order("brand_name", { ascending: true });
  const portfolioBrands = portfolioRes.error
    ? []
    : (portfolioRes.data ?? []).map((r) => r.brand_name as string);

  const passport: StylePassport = normalizeStylePassport(
    profile?.style_passport ?? {},
  );

  const { constraints, constraintSummary } = await buildConstraintsFromMessages({
    messages: [{ role: "user", content: parsed.data.q }],
    passport,
    portfolioBrands,
    vision: parsed.data.vision,
    fast: parsed.data.fast,
  });

  const res = await searchRevolveCatalogPage(
    parsed.data.q,
    constraints,
    {
      offset: parsed.data.offset,
      limit: parsed.data.limit,
    },
  );

  const response_summary = buildResponseSummary(res.total);

  return NextResponse.json({
    q: parsed.data.q,
    offset: parsed.data.offset,
    limit: parsed.data.limit,
    total: res.total,
    strictFiltered: res.strictFiltered,
    parsedFilters: res.parsedFilters,
    filters: res.displayFilters,
    products: res.products,
    constraintSummary,
    response_summary,
    hasMore: parsed.data.offset + res.products.length < res.total,
    nextOffset: parsed.data.offset + res.products.length,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_passport")
    .eq("id", user.id)
    .maybeSingle();

  const portfolioRes = await supabase
    .from("user_brand_portfolio")
    .select("brand_name")
    .eq("user_id", user.id)
    .order("brand_name", { ascending: true });
  const portfolioBrands = portfolioRes.error
    ? []
    : (portfolioRes.data ?? []).map((r) => r.brand_name as string);

  const passport: StylePassport = normalizeStylePassport(
    profile?.style_passport ?? {},
  );

  const prevState: ChatFilterState =
    (parsed.data.filter_state as ChatFilterState | undefined) ??
    defaultChatFilterState();

  const lastUser =
    [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content?.trim() ??
    "";

  let state = prevState;
  let newlyExtracted: string[] = [];
  let missing: string[] = [];
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!parsed.data.skip_extract) {
    if (geminiKey && lastUser && !parsed.data.fast) {
      try {
        const extracted = await extractChatFiltersWithGemini({
          apiKey: geminiKey,
          modelName: process.env.GEMINI_MODEL,
          message: lastUser,
          prevState,
          passport,
          portfolioBrands,
        });
        state = extracted.state;
        newlyExtracted = extracted.newlyExtracted;
        missing = extracted.missing;
      } catch {
        // fall back to prev state
      }
    }

    // Safety net: heuristic extraction so users still get results when Gemini is slow/quota'd.
    const heur = lastUser ? heuristicExtractFiltersFromMessage(lastUser) : {};
    state = {
      ...state,
      category: state.category ?? (heur.category ?? null),
      color: state.color ?? (heur.color ?? null),
      size: state.size ?? (heur.size ?? null),
      budget: state.budget ?? (heur.budget ?? null),
      brand: state.brand ?? (heur.brand ?? null),
      description: state.description ?? (heur.description ?? null),
    };
  }

  let { constraints, query, constraintSummary } = constraintsFromState({
    state,
    passport,
    portfolioBrands,
    vision: parsed.data.vision,
  });

  // Final fallback: if query is still empty, search by the raw last user message.
  if (!query) {
    query = lastUser.slice(0, 400).trim();
    const built = await buildConstraintsFromMessages({
      messages: parsed.data.messages,
      passport,
      portfolioBrands,
      vision: parsed.data.vision,
      fast: parsed.data.fast,
    });
    constraints = built.constraints;
    constraintSummary = built.constraintSummary;
  }

  if (!query) {
    return NextResponse.json({ error: "No user message found" }, { status: 400 });
  }

  const res = await searchRevolveCatalogPage(
    query,
    constraints,
    {
      offset: parsed.data.offset,
      limit: parsed.data.limit,
    },
    parsed.data.filters !== undefined
      ? { clientFilters: parsed.data.filters }
      : undefined,
  );

  const response_summary = buildResponseSummary(res.total);

  return NextResponse.json({
    q: query,
    offset: parsed.data.offset,
    limit: parsed.data.limit,
    total: res.total,
    strictFiltered: res.strictFiltered,
    parsedFilters: res.parsedFilters,
    filters: res.displayFilters,
    products: res.products,
    constraintSummary,
    response_summary,
    hasMore: parsed.data.offset + res.products.length < res.total,
    nextOffset: parsed.data.offset + res.products.length,
    filter_state: state,
    newly_extracted: newlyExtracted,
    missing_filters: missing,
  });
}

