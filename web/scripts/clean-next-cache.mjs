/**
 * Removes local Next.js output folders (run when .next is corrupted or after OneDrive sync glitches).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of [".next", ".next-build"]) {
  const p = path.join(cwd, name);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("removed:", p);
  } catch (e) {
    console.warn("skip:", p, e.message);
  }
}
