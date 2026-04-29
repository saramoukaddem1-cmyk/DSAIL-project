import { revolveCatalogReady } from "@/lib/revolve/catalog-path";

/**
 * Normalized INSPO_PROVIDER (trimmed, lowercased).
 */
export function getInspoProvider(): string {
  return (
    (process.env.INSPO_PROVIDER ?? "auto").replace(/^\uFEFF/, "").trim().toLowerCase() ||
    "auto"
  );
}

/**
 * Use local Revolve JSON when:
 * - INSPO_PROVIDER=revolve (always — API returns a clear error if the file is missing), or
 * - not serpapi|retailed AND web/data/products_cleaned.json exists (works from `web` or repo root cwd).
 */
export function isRevolveCatalogPreferred(): boolean {
  const p = getInspoProvider();
  if (p === "serpapi" || p === "retailed") return false;
  if (p === "revolve") return true;
  return revolveCatalogReady();
}
