import fs from "node:fs";
import path from "node:path";

/**
 * Default catalog filenames under `web/data/`, tried in order until one exists.
 * Override with `REVOLVE_CATALOG_FILE` (single filename) or `REVOLVE_CATALOG_PATH` (full path).
 */
export const REVOLVE_CATALOG_DEFAULT_FILES = [
  "products_cleaned.json",
  "revolve_products.json",
] as const;

function catalogFileNames(): string[] {
  const env = process.env.REVOLVE_CATALOG_FILE?.trim();
  if (env) return [env];
  return [...REVOLVE_CATALOG_DEFAULT_FILES];
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Candidate locations for the catalog JSON.
 * Next may run with cwd = `web`, monorepo root, or (rarely) another folder; npm sets INIT_CWD.
 * Override with REVOLVE_CATALOG_PATH (absolute or relative to cwd), or REVOLVE_CATALOG_FILE for the name under `web/data`.
 */
export function getRevolveCatalogCandidatePaths(): string[] {
  const cwd = process.cwd();
  const init = process.env.INIT_CWD?.trim();
  const envOverride = process.env.REVOLVE_CATALOG_PATH?.trim();

  const bases = [cwd, ...(init && init !== cwd ? [init] : [])];

  const fromBases: string[] = [];
  for (const file of catalogFileNames()) {
    for (const base of bases) {
      fromBases.push(
        path.join(base, "data", file),
        path.join(base, "web", "data", file),
        path.join(base, "..", "web", "data", file),
      );
    }
  }

  const extra: string[] = [];
  if (envOverride) {
    if (path.isAbsolute(envOverride)) {
      extra.push(envOverride);
    } else {
      for (const base of bases) {
        extra.push(path.resolve(base, envOverride));
      }
    }
  }

  return uniquePaths([...extra, ...fromBases]);
}

/**
 * Next may run with cwd = `web` or monorepo root — try candidates until a file exists.
 */
export function getRevolveCatalogFilePath(): string {
  for (const p of getRevolveCatalogCandidatePaths()) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  const names = catalogFileNames();
  return path.join(process.cwd(), "data", names[0]!);
}

export function revolveCatalogReady(): boolean {
  try {
    const p = getRevolveCatalogFilePath();
    if (!fs.existsSync(p)) return false;
    const st = fs.statSync(p);
    return st.isFile() && st.size > 32;
  } catch {
    return false;
  }
}
