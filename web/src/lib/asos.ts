import type { AsosProduct } from "@/types/asos";

type RawAsos = {
  id: number;
  name: string;
  brandName?: string | null;
  colour?: string | null;
  price?: { current?: { text?: string }; currency?: string };
  imageUrl?: string;
  url?: string;
};

function buildImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  const base = imageUrl.startsWith("http") ? imageUrl : `https://${imageUrl}`;
  return base.includes("?") ? base : `${base}?$n_640w$&wid=800&fit=constrain`;
}

function buildBuyUrl(relativePath: string | undefined): string | null {
  if (!relativePath) return null;
  const path = relativePath.split("#")[0];
  return `https://www.asos.com/us/${path}`;
}

export function mapAsosProduct(p: RawAsos): AsosProduct {
  return {
    id: String(p.id),
    name: p.name,
    brand: p.brandName ?? null,
    colour: p.colour ?? null,
    priceText: p.price?.current?.text ?? "",
    currency: p.price?.currency ?? "USD",
    image: buildImageUrl(p.imageUrl),
    buyUrl: buildBuyUrl(p.url),
  };
}

export async function searchProductsByTerm(
  searchTerm: string,
  opts: { limit?: number },
): Promise<AsosProduct[]> {
  const key = process.env.RAPIDAPI_KEY?.trim();
  const host = (process.env.RAPIDAPI_HOST ?? "asos10.p.rapidapi.com").trim();
  if (!key) {
    throw new Error("RAPIDAPI_KEY is not configured");
  }
  const limit = Math.min(opts.limit ?? 12, 24);
  const url = new URL("/api/v1/getProductListBySearchTerm", `https://${host}`);
  url.searchParams.set("searchTerm", searchTerm);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ASOS API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    data?: { products?: unknown[] };
    message?: string;
  };
  const raw = body.data?.products;
  if (!Array.isArray(raw)) {
    throw new Error(body.message ?? "Unexpected ASOS response");
  }

  return raw.slice(0, limit).map((p) => mapAsosProduct(p as RawAsos));
}
