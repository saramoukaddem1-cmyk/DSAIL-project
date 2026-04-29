/**
 * Frees port 3000 (avoids stale Next returning 500s), removes .next, starts dev.
 * Run: npm run dev:fresh
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3000;

const require = createRequire(path.join(root, "package.json"));
let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch {
  console.error("Could not resolve next/dist/bin/next. Run npm install in web/.");
  process.exit(1);
}

function cleanNext() {
  for (const name of [".next", ".next-build"]) {
    const p = path.join(root, name);
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log("removed:", p);
    } catch (e) {
      console.warn("skip:", p, e?.message ?? e);
    }
  }
}

function killListenersOnPortWin32(port) {
  try {
    const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
    if (out.status !== 0 || !out.stdout) return;
    const pids = new Set();
    for (const line of out.stdout.split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      console.log(`Stopping PID ${pid} (was listening on ${port})`);
      spawnSync("taskkill", ["/F", "/PID", pid], { stdio: "inherit" });
    }
  } catch (e) {
    console.warn("killListenersOnPort (win32):", e?.message ?? e);
  }
}

function killListenersOnPortUnix(port) {
  try {
    spawnSync("sh", [
      "-c",
      `for pid in $(lsof -ti:${port} 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done`,
    ]);
  } catch {
    /* lsof may be missing */
  }
}

function main() {
  console.log(`Freeing port ${PORT} and clearing Next cache…`);
  if (process.platform === "win32") killListenersOnPortWin32(PORT);
  else killListenersOnPortUnix(PORT);

  cleanNext();

  const env = {
    ...process.env,
    // Large catalog JSON parse + product arrays — avoid OOM on modest heaps
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=8192"]
      .filter(Boolean)
      .join(" "),
  };

  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--port", String(PORT)],
    { cwd: root, stdio: "inherit", env },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}

main();
