import type { AsosProduct } from "@/types/asos";

type SerpApiShoppingResult = {
  product_id?: string;
  title?: string;
  price?: string;
  extracted_price?: number;
  currency?: string;
  product_link?: string;
  immersive_product_page_token?: string;
  serpapi_immersive_product_api?: string;
  thumbnail?: string;
  source?: string;
  merchant?: string;
  brand?: string;
};

type SerpApiShoppingResponse = {
  shopping_results?: SerpApiShoppingResult[];
  error?: string;
};

type SerpApiImmersiveProductResponse = {
  product_results?: {
    stores?: Array<{
      name?: string;
      link?: string;
      price?: string;
      extracted_price?: number;
    }>;
    brand?: string;
  };
  error?: string;
};

export async function searchGoogleShoppingByTerm(
  searchTerm: string,
  opts: { limit?: number; gl?: string; hl?: string } = {},
): Promise<AsosProduct[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPAPI_API_KEY is not configured");

  const limit = Math.min(Math.max(1, opts.limit ?? 20), 40);
  const gl = (opts.gl ?? "us").toLowerCase();
  const hl = (opts.hl ?? "en").toLowerCase();

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", searchTerm);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  let json: SerpApiShoppingResponse;
  try {
    json = JSON.parse(text) as SerpApiShoppingResponse;
  } catch {
    throw new Error(`SerpAPI ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `SerpAPI ${res.status}: ${(json.error ?? text).slice(0, 200)}`,
    );
  }

  const results = Array.isArray(json.shopping_results)
    ? json.shopping_results
    : [];

  return results.slice(0, limit).map((r): AsosProduct => {
    const id =
      r.product_id ||
      r.product_link ||
      r.title ||
      `serp_${Math.random().toString(16).slice(2)}`;
    const brandish = r.brand ?? r.source ?? r.merchant ?? null;
    return {
      id,
      name: r.title ?? "Shopping item",
      brand: brandish,
      colour: null,
      priceText: r.price ?? "",
      currency: r.currency ?? inferCurrency(r.price),
      image: r.thumbnail ?? null,
      buyUrl: r.product_link ?? null,
    };
  });
}

/**
 * Enriches Google Shopping results with real merchant links by calling the
 * `google_immersive_product` endpoint per product.
 *
 * This costs extra requests, but produces stable `buyUrl` domains that we can
 * filter against `ALLOWED_SHOP_DOMAINS`.
 */
export async function searchGoogleShoppingByTermWithStores(
  searchTerm: string,
  opts: {
    limit?: number;
    gl?: string;
    hl?: string;
    allowedDomains?: string[];
  } = {},
): Promise<AsosProduct[]> {
  const allowed = (opts.allowedDomains ?? []).map((s) => s.toLowerCase());

  const base = await searchGoogleShoppingRaw(searchTerm, {
    limit: Math.min(opts.limit ?? 12, 20),
    gl: opts.gl,
    hl: opts.hl,
  });

  const out: AsosProduct[] = [];
  for (const r of base) {
    const enriched = await enrichWithStore(r, allowed);
    if (enriched) out.push(enriched);
    if (out.length >= (opts.limit ?? 12)) break;
  }
  return out;
}

async function searchGoogleShoppingRaw(
  searchTerm: string,
  opts: { limit: number; gl?: string; hl?: string },
): Promise<SerpApiShoppingResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPAPI_API_KEY is not configured");

  const gl = (opts.gl ?? "us").toLowerCase();
  const hl = (opts.hl ?? "en").toLowerCase();

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", searchTerm);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  let json: SerpApiShoppingResponse;
  try {
    json = JSON.parse(text) as SerpApiShoppingResponse;
  } catch {
    throw new Error(`SerpAPI ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `SerpAPI ${res.status}: ${(json.error ?? text).slice(0, 200)}`,
    );
  }

  const results = Array.isArray(json.shopping_results)
    ? json.shopping_results
    : [];
  return results.slice(0, opts.limit);
}

async function enrichWithStore(
  r: SerpApiShoppingResult,
  allowedDomains: string[],
): Promise<AsosProduct | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const immersiveUrl =
    r.serpapi_immersive_product_api ??
    (r.immersive_product_page_token
      ? `https://serpapi.com/search.json?engine=google_immersive_product&page_token=${encodeURIComponent(
          r.immersive_product_page_token,
        )}`
      : null);

  let storeLink: string | null = null;
  let storeName: string | null = null;
  let storePrice: string | undefined;

  if (immersiveUrl) {
    const url = new URL(immersiveUrl);
    if (!url.searchParams.get("api_key")) url.searchParams.set("api_key", apiKey);

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    let json: SerpApiImmersiveProductResponse;
    try {
      json = JSON.parse(text) as SerpApiImmersiveProductResponse;
    } catch {
      json = {};
    }

    const stores = json.product_results?.stores ?? [];
    const pick =
      allowedDomains.length > 0
        ? stores.find((s) => {
            const link = s.link;
            if (!link) return false;
            try {
              const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
              return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
            } catch {
              return false;
            }
          }) ?? stores[0]
        : stores[0];

    storeLink = pick?.link ?? null;
    storeName = pick?.name ?? null;
    storePrice = pick?.price;
  }

  const id =
    r.product_id ||
    storeLink ||
    r.product_link ||
    r.title ||
    `serp_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: r.title ?? "Shopping item",
    brand: storeName ?? r.source ?? r.brand ?? null,
    colour: null,
    priceText: storePrice ?? r.price ?? "",
    currency: r.currency ?? inferCurrency(storePrice ?? r.price),
    image: r.thumbnail ?? null,
    buyUrl: storeLink ?? r.product_link ?? null,
  };
}

function inferCurrency(price: string | undefined): string {
  if (!price) return "USD";
  if (price.includes("€")) return "EUR";
  if (price.includes("£")) return "GBP";
  if (price.includes("$")) return "USD";
  return "USD";
}

