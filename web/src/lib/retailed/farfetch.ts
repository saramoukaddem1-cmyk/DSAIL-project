import type { AsosProduct } from "@/types/asos";

type RetailedFarfetchSearchResult = {
  productId?: string;
  name?: string;
  designer?: string;
  images?: string[];
  url?: string;
  price?: string;
};

type RetailedFarfetchSearchResponse = {
  query?: string;
  results?: RetailedFarfetchSearchResult[];
  error?: string;
};

export async function searchFarfetchByTerm(
  searchTerm: string,
  opts: { limit?: number } = {},
): Promise<AsosProduct[]> {
  const apiKey = process.env.RETAILED_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RETAILED_API_KEY is not configured");
  }

  const limit = Math.min(Math.max(1, opts.limit ?? 20), 30);
  const base = (process.env.RETAILED_BASE_URL ?? "https://app.retailed.io").trim();

  const url = new URL("/api/v1/scraper/farfetch/search", base);
  url.searchParams.set("query", searchTerm);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  const rawText = await res.text();
  let json: RetailedFarfetchSearchResponse;
  try {
    json = JSON.parse(rawText) as RetailedFarfetchSearchResponse;
  } catch {
    throw new Error(`Retailed Farfetch ${res.status}: ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Retailed Farfetch ${res.status}: ${(json.error ?? rawText).slice(0, 200)}`,
    );
  }

  const results = Array.isArray(json.results) ? json.results : [];
  return results.slice(0, limit).map((r): AsosProduct => {
    const id = r.productId || r.url || r.name || cryptoRandomId();
    return {
      id,
      name: r.name ?? "Farfetch item",
      brand: r.designer ?? null,
      colour: null,
      priceText: r.price ?? "",
      currency: inferCurrency(r.price),
      image: Array.isArray(r.images) ? r.images[0] ?? null : null,
      buyUrl: r.url ?? null,
    };
  });
}

function inferCurrency(price: string | undefined): string {
  if (!price) return "USD";
  if (price.includes("€")) return "EUR";
  if (price.includes("£")) return "GBP";
  if (price.includes("$")) return "USD";
  return "USD";
}

function cryptoRandomId(): string {
  // Avoid importing node:crypto in edge runtimes; use a tiny random fallback.
  return `ff_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

