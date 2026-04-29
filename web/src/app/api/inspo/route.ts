import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInspoProvider, isRevolveCatalogPreferred } from "@/lib/inspo-provider";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import { searchFarfetchByTerm } from "@/lib/retailed/farfetch";
import { getRevolveCatalogInspoPage } from "@/lib/revolve/revolve-catalog";
import { searchGoogleShoppingByTermWithStores } from "@/lib/serpapi/google-shopping";
import {
  filterProductsByAllowedDomains,
  parseAllowedShopDomains,
} from "@/lib/shop-domain-filter";

const SEEDS = [
  "minimal outfit",
  "pastel spring",
  "streetwear look",
  "evening dress",
  "tailored coat",
  "sneakers new season",
  "linen vacation",
  "denim editorial",
];

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idxRaw = Number(searchParams.get("i") ?? "0");
  const idx = Number.isFinite(idxRaw) ? idxRaw : 0;
  const seed = SEEDS[Math.abs(Math.floor(idx)) % SEEDS.length] ?? SEEDS[0];
  const offRaw = searchParams.get("offset");
  const offNum = offRaw == null || offRaw === "" ? 0 : Number(offRaw);
  const offset = Math.max(0, Number.isFinite(offNum) ? Math.floor(offNum) : 0);
  const limRaw = searchParams.get("limit");
  const limNum = limRaw == null || limRaw === "" ? 20 : Number(limRaw);
  const limit = Math.min(
    40,
    Math.max(8, Number.isFinite(limNum) ? Math.floor(limNum) : 20),
  );

  const provider = getInspoProvider();
  const hasRevolve = isRevolveCatalogPreferred();
  const hasSerp = Boolean(process.env.SERPAPI_API_KEY?.trim());
  const hasRetailed = Boolean(process.env.RETAILED_API_KEY?.trim());
  if (!hasRevolve && !hasSerp && !hasRetailed) {
    return NextResponse.json(
      {
        error:
          "Inspo is not configured. Set INSPO_PROVIDER=revolve and fill web/data/products_cleaned.json, or add SERPAPI_API_KEY or RETAILED_API_KEY to web/.env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  try {
    const allowedDomains = parseAllowedShopDomains(
      process.env.ALLOWED_SHOP_DOMAINS,
    );
    if (hasRevolve) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("style_passport")
        .eq("id", user.id)
        .maybeSingle();
      const portfolioRes = await supabase
        .from("user_brand_portfolio")
        .select("brand_name")
        .eq("user_id", user.id);
      const portfolioBrands = portfolioRes.error
        ? []
        : (portfolioRes.data ?? []).map((r) => r.brand_name as string);
      const passport: StylePassport = normalizeStylePassport(
        profile?.style_passport ?? {},
      );
      const portfolioLower = new Set(
        portfolioBrands.map((b) => b.toLowerCase()),
      );
      const sizeTokens = new Set<string>();
      if (passport.wardrobe) {
        for (const w of Object.values(passport.wardrobe)) {
          for (const s of w.sizes ?? []) {
            if (s?.trim()) sizeTokens.add(s.trim().toLowerCase());
          }
        }
      }
      const globalBudgetMax =
        typeof passport.budgetMax === "number" && Number.isFinite(passport.budgetMax)
          ? passport.budgetMax
          : null;

      const { products: slice, hasMore, nextCatalogOffset } =
        await getRevolveCatalogInspoPage(offset, limit, {
          portfolioLower,
          sizeTokens,
          globalBudgetMax,
        });
      return NextResponse.json({
        seed,
        offset,
        limit,
        products: slice,
        hasMore,
        nextCatalogOffset,
      });
    }

    const products =
      provider === "serpapi" || (provider === "auto" && hasSerp)
        ? await searchGoogleShoppingByTermWithStores(seed, {
            limit,
            gl: "us",
            hl: "en",
            allowedDomains,
          })
        : await searchFarfetchByTerm(seed, { limit });
    const filtered = filterProductsByAllowedDomains(products, allowedDomains);
    return NextResponse.json({
      seed,
      offset,
      limit,
      products: filtered,
      hasMore: filtered.length > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inspo request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

