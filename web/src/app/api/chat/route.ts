import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchProducts } from "@/lib/search-products";
import {
  extractChatShoppingIntent,
  planFromHeuristicOnly,
} from "@/lib/chat-shopping-intent";
import { searchFarfetchByTerm } from "@/lib/retailed/farfetch";
import { getInspoProvider, isRevolveCatalogPreferred } from "@/lib/inspo-provider";
import {
  searchRevolveWithChatConstraints,
  type RevolveChatConstraints,
} from "@/lib/revolve/revolve-catalog";
import { searchGoogleShoppingByTermWithStores } from "@/lib/serpapi/google-shopping";
import {
  filterProductsByAllowedDomains,
  parseAllowedShopDomains,
} from "@/lib/shop-domain-filter";
import { lastUserMessage as lastUserFromThread } from "@/lib/chat-thread";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import type { AsosProduct } from "@/types/asos";

const BodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
});

const searchTool = {
  type: "function" as const,
  function: {
    name: "search_products",
    description:
      "Search the SKU product catalog. Use filters from the user and their style passport. Prices are in cents.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text match on title, description, brand",
        },
        category: {
          type: "string",
          description:
            "Optional hint: dresses, tops, skirts, pants, jeans, shoes, outerwear, etc.",
        },
        max_price_cents: {
          type: "integer",
          description: "Maximum price in cents (e.g. 10000 = $100)",
        },
        brand: {
          type: "string",
          description: "Brand name substring",
        },
      },
    },
  },
};

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
  const fromTable: string[] = portfolioRes.error
    ? []
    : (portfolioRes.data ?? []).map((r) => r.brand_name as string);

  const passport: StylePassport = normalizeStylePassport(
    profile?.style_passport ?? {},
  );
  const fromPassportBrands = passport.brands ?? [];
  const portfolioBrands = [
    ...new Set(
      [...fromTable, ...fromPassportBrands]
        .map((b) => b.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const passportSummary = JSON.stringify(passport, null, 2);
  const brandsSummary =
    portfolioBrands.length > 0
      ? `\nBrands on their passport: ${portfolioBrands.join(", ")}`
      : "";

  const provider = getInspoProvider();
  const useRevolve = isRevolveCatalogPreferred();
  const useSerp = Boolean(process.env.SERPAPI_API_KEY?.trim());
  const useRetailed = Boolean(process.env.RETAILED_API_KEY?.trim());

  if (useSerp || useRetailed || useRevolve) {
    const lastUser = lastUserFromThread(parsed.data.messages);
    if (!lastUser) {
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 },
      );
    }

    let searchTerm = lastUser.slice(0, 200);
    let assistantBrief = "Here are some pieces we found.";
    let maxProducts = 12;

    let mergedPlan: Awaited<ReturnType<typeof extractChatShoppingIntent>> | null =
      null;
    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        mergedPlan = await extractChatShoppingIntent(lastUser, {
          apiKey: process.env.GEMINI_API_KEY!.trim(),
          modelName: process.env.GEMINI_MODEL,
          portfolioBrands,
          passport,
          messages: parsed.data.messages,
        });
      } catch (e) {
        console.warn("Gemini shopping intent failed:", e);
      }
    }
    if (!mergedPlan) {
      mergedPlan = planFromHeuristicOnly(
        parsed.data.messages,
        passport,
        portfolioBrands.length,
      );
    }
    searchTerm = mergedPlan.searchTerm || searchTerm;
    assistantBrief = mergedPlan.assistantBrief;
    maxProducts = mergedPlan.maxProducts;
    const constraintSummary = mergedPlan.constraintSummary;
    // Keep `constraintSummary` in the JSON payload for internal UI logic (chips, debugging),
    // but avoid rendering a big "Active filters: …" block in the user-visible reply.
    const replyWithConstraints = assistantBrief.trim() || "Here are some picks.";

    let products: AsosProduct[] = [];
    try {
      const allowedDomains = parseAllowedShopDomains(
        process.env.ALLOWED_SHOP_DOMAINS,
      );
      if (useRevolve) {
        const constraints: RevolveChatConstraints = {
          maxUsd: mergedPlan.maxUsd,
          gender: passport.gender,
          colorKeywords: mergedPlan.colorKeywords,
          boostColorKeywords: mergedPlan.boostColorKeywords,
          sizeTokens: mergedPlan.sizeTokens,
          categorySubstrings: mergedPlan.categorySubstrings,
          brandKeywords: mergedPlan.brandKeywords,
          detailKeywords: mergedPlan.detailKeywords,
          portfolioBrandNames: portfolioBrands,
          portfolioOnly: mergedPlan.portfolioOnly,
          preferPortfolioBoost: mergedPlan.preferPortfolioBoost,
        };
        products = await searchRevolveWithChatConstraints(
          mergedPlan.searchTerm,
          constraints,
          { finalLimit: maxProducts, poolLimit: 520 },
        );
      } else {
        products =
          provider === "serpapi" || (provider === "auto" && useSerp)
            ? await searchGoogleShoppingByTermWithStores(searchTerm, {
                limit: maxProducts,
                gl: "us",
                hl: "en",
                allowedDomains,
              })
            : await searchFarfetchByTerm(searchTerm, { limit: maxProducts });

        products = filterProductsByAllowedDomains(products, allowedDomains);

        if (portfolioBrands.length > 0) {
          const set = new Set(portfolioBrands.map((b) => b.toLowerCase()));
          const boosted = products.filter((p) =>
            p.brand ? set.has(p.brand.toLowerCase()) : false,
          );
          const rest = products.filter(
            (p) => !p.brand || !set.has(p.brand.toLowerCase()),
          );
          products = [...boosted, ...rest].slice(0, maxProducts);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (!products.length) {
      return NextResponse.json({
        reply:
          constraintSummary && constraintSummary.trim()
            ? "No matches for your filters. Try broadening one thing (budget, color, or size) or add more stores in ALLOWED_SHOP_DOMAINS."
            : "No matches from your allowed shops. Add more domains in ALLOWED_SHOP_DOMAINS or try broader keywords.",
        products: [],
        searchTerm,
        constraintSummary,
        followUpChips: mergedPlan.followUpChips,
        savedBrandCount: portfolioBrands.length,
        mode: "products",
      });
    }

    return NextResponse.json({
      reply: replyWithConstraints,
      products,
      searchTerm,
      constraintSummary,
      followUpChips: mergedPlan.followUpChips,
      savedBrandCount: portfolioBrands.length,
      mode: "products",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Set INSPO_PROVIDER=revolve with web/data/products_cleaned.json, or configure SERPAPI_API_KEY / RETAILED_API_KEY for shoppable results, or OPENAI_API_KEY for catalog chat.",
      },
      { status: 500 },
    );
  }

  const system = `You are SKU, a fashion shopping assistant. Help the user find clothing and accessories.

Rules:
- You only recommend items returned by the search_products tool. Do not invent products, prices, or URLs.
- Respect the style passport when searching: gender, category preferences, colors, sizes, per-category budgets (preferredCurrency), and brands the user cares about.
- Keep answers concise; list a few options with title, brand, price (use currency from row), and why it fits.
- If search returns nothing, say so and suggest broader filters.

Style passport (JSON):
${passportSummary}${brandsSummary}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...parsed.data.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  let completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages,
    tools: [searchTool],
    tool_choice: "auto",
  });

  let choice = completion.choices[0]?.message;
  let toolRound = 0;

  while (choice?.tool_calls?.length && toolRound < 4) {
    toolRound += 1;
    const toolCall = choice.tool_calls[0];
    if (toolCall.type !== "function" || toolCall.function.name !== "search_products") {
      break;
    }

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      args = {};
    }

    const maxCents =
      typeof args.max_price_cents === "number"
        ? args.max_price_cents
        : passport.budgetMax != null
          ? Math.round(passport.budgetMax * 100)
          : undefined;

    const rows = await searchProducts({
      query: typeof args.query === "string" ? args.query : undefined,
      category: typeof args.category === "string" ? args.category : undefined,
      maxPriceCents: maxCents,
      brand: typeof args.brand === "string" ? args.brand : undefined,
      limit: 12,
    });

    messages.push(choice);
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({ products: rows }),
    });

    completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      tools: [searchTool],
      tool_choice: "auto",
    });
    choice = completion.choices[0]?.message;
  }

  const text = choice?.content?.trim() ?? "Sorry, I could not generate a reply.";

  return NextResponse.json({ reply: text, mode: "catalog" });
}
