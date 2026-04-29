/**
 * Relabel primary_color_group using pixel-based image analysis (no LLM credits required).
 *
 * Output: writes a new JSON array file with updated:
 * - primary_color_group
 * - normalized_colors
 * - secondary_color_groups
 * - color_confidence
 * - color_notes
 *
 * Usage (PowerShell):
 *   node scripts/relabel-colors.mjs --in data/products_cleaned.json --out data/products_cleaned.recolored.json
 *
 * Notes:
 * - Streams input (does not load whole file into memory).
 * - Uses small image downscale + hue histogram for dominant garment color.
 */
import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { promisify } from "node:util";
import { createGunzip } from "node:zlib";
import { createRequire } from "node:module";
import sharp from "sharp";

// stream-json is CJS, use require for compatibility across Node versions.
const require = createRequire(import.meta.url);
const streamArrayMod = require("stream-json/streamers/stream-array.js");

const sleep = promisify(setTimeout);

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function argInt(name, fallback) {
  const v = argValue(name, null);
  if (v == null) return fallback;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function stripToFirstJsonArray() {
  let started = false;
  return new Transform({
    transform(chunk, _enc, cb) {
      try {
        if (started) {
          cb(null, chunk);
          return;
        }
        const s = chunk.toString("utf8");
        const i = s.indexOf("[");
        if (i === -1) {
          cb(null, Buffer.alloc(0));
          return;
        }
        started = true;
        cb(null, Buffer.from(s.slice(i), "utf8"));
      } catch (e) {
        cb(e);
      }
    },
  });
}

function normToken(s) {
  return String(s ?? "").trim().toLowerCase();
}

function rgbToHsv(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hueToGroup(h) {
  // Hue buckets tuned for fashion-ish categories.
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 255) return "blue";
  if (h < 345) return "purple";
  return "red";
}

function pixelToGroup({ h, s, v }) {
  // Neutrals first.
  if (s < 0.14) {
    if (v > 0.86) return "white";
    if (v < 0.22) return "black";
    return "grey";
  }

  // Beige / tan / brown live in the "orange" hue zone but are lower saturation.
  const inWarm = h >= 15 && h < 60;
  if (inWarm && s < 0.45) {
    if (v < 0.35) return "brown";
    if (v > 0.78) return "beige";
    return "tan";
  }

  // Denim often has low saturation but should still be "blue".
  if (h >= 180 && h < 255 && s < 0.28 && v >= 0.22 && v <= 0.82) {
    return "blue";
  }

  let g = hueToGroup(h);
  if (g === "red") g = inferPinkVsRed(h);
  return g;
}

function inferPinkVsRed(h) {
  // Reds close to magenta often feel "pink".
  // Pink is mostly around 300-345 + some lighter reds.
  if (h >= 300 && h < 345) return "pink";
  return "red";
}

function classifyFromHistogram(hist) {
  // hist: {group -> weight}
  const entries = Object.entries(hist).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const second = entries[1];
  if (!top) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const topShare = top[1] / total;
  const secondShare = second ? second[1] / total : 0;
  const dominance = topShare - secondShare;

  let confidence = "low";
  if (topShare >= 0.62 && dominance >= 0.24) confidence = "high";
  else if (topShare >= 0.48 && dominance >= 0.14) confidence = "medium";

  const isMulti = topShare < 0.45 || (secondShare > 0.22 && dominance < 0.12);
  if (isMulti) {
    return { primary: "multi", confidence, topShare, secondShare };
  }
  return { primary: top[0], confidence, topShare, secondShare };
}

async function fetchImageBuffer(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function dominantColorFromImage(url, opts) {
  const buf = await fetchImageBuffer(url, opts.timeoutMs);
  if (!buf) return null;

  let img;
  try {
    img = sharp(buf, { failOn: "none" }).resize(opts.size, opts.size, { fit: "cover" });
  } catch {
    return null;
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  if (channels < 3) return null;

  // Weighted histogram. Filter out near-white backgrounds and near-black shadows.
  const hist = Object.create(null);
  let kept = 0;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const { h, s, v } = rgbToHsv(r, g, b);

    // Ignore likely background: very bright low-sat or very dark.
    if (v > 0.93 && s < 0.12) continue;
    if (v < 0.08) continue;

    const group = pixelToGroup({ h, s, v });
    const weight = Math.max(0.18, s) * (0.6 + 0.4 * v);
    hist[group] = (hist[group] ?? 0) + weight;
    kept += 1;
  }

  if (kept < 40) return null;
  return classifyFromHistogram(hist);
}

function rawColorOverride(raw) {
  const t = normToken(raw);
  if (!t) return null;
  if (/\bblack\b/.test(t)) return "black";
  if (/\bwhite\b/.test(t)) return "white";
  if (/\b(grey|gray|charcoal)\b/.test(t)) return "grey";
  if (/\b(brown|chocolate|espresso)\b/.test(t)) return "brown";
  if (/\b(beige|cream|ivory|oyster|stone)\b/.test(t)) return "beige";
  if (/\b(tan|nude|camel)\b/.test(t)) return "tan";
  if (/\b(pink|blush|rose|fuchsia|mauve)\b/.test(t)) return "pink";
  if (/\b(red|burgundy|wine|maroon)\b/.test(t)) return "red";
  if (/\b(spice|paprika|cayenne|rust|brick|terracotta)\b/.test(t)) return "red";
  if (/\b(orange|coral)\b/.test(t)) return "orange";
  if (/\b(yellow|lemon|butter)\b/.test(t)) return "yellow";
  if (/\b(green|olive|sage|mint)\b/.test(t)) return "green";
  if (/\b(blue|navy|denim)\b/.test(t)) return "blue";
  if (/\b(purple|lilac|lavender|violet)\b/.test(t)) return "purple";
  if (/\b(gold|metallic gold)\b/.test(t)) return "gold";
  if (/\b(silver|metallic silver)\b/.test(t)) return "silver";
  if (/\bmulti\b/.test(t)) return "multi";
  return null;
}

function mergeColorFields(item, pred) {
  const previous = normToken(item.primary_color_group || item.primaryColorGroup);
  const raw = normToken(item.raw_color || item.colour || item.color);
  const rawHint = rawColorOverride(raw);
  let primary = pred?.primary ?? (previous || null);
  let confidence = pred?.confidence ?? (item.color_confidence || "low");

  // If text strongly indicates a base color and vision isn't high-confidence, trust text.
  if (rawHint && confidence !== "high") {
    primary = rawHint;
    confidence = confidence === "low" ? "medium" : confidence;
  }

  const normalized = primary && primary !== "multi" ? [primary] : primary ? [primary] : [];
  const out = { ...item };
  out.primary_color_group = primary;
  out.normalized_colors = normalized;
  out.secondary_color_groups = primary && primary !== "multi" ? [] : (item.secondary_color_groups ?? []);
  out.color_confidence = confidence;
  out.color_notes = [
    item.color_notes ? String(item.color_notes) : null,
    pred
      ? `image->${primary} (topShare=${pred.topShare?.toFixed?.(2) ?? "?"}) raw=${raw || "?"}`
      : `image_unavailable raw=${raw || "?"}`,
  ]
    .filter(Boolean)
    .join(" | ");
  return out;
}

async function main() {
  const inPath = argValue("in", "data/products_cleaned.json");
  const outPath = argValue("out", "data/products_cleaned.recolored.json");
  const size = argInt("thumb", 42);
  const concurrency = argInt("concurrency", 10);
  const timeoutMs = argInt("timeout", 8000);
  const maxItems = argInt("max", -1);
  const skip = argInt("skip", 0);

  const absIn = path.isAbsolute(inPath) ? inPath : path.join(process.cwd(), inPath);
  const absOut = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);

  const readStream = fs.createReadStream(absIn);
  const isGz = absIn.toLowerCase().endsWith(".gz");
  const srcRaw = isGz ? readStream.pipe(createGunzip()) : readStream;
  const src = srcRaw.pipe(stripToFirstJsonArray());

  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  const out = fs.createWriteStream(absOut, { encoding: "utf8" });
  out.write("[\n");

  const q = [];
  let running = 0;
  let idx = 0;
  let wrote = 0;
  let enqueued = 0;
  let first = true;
  let lastLog = Date.now();
  const maxQueue = argInt("maxQueue", 500);
  let stopping = false;

  async function enqueue(fn) {
    if (maxItems >= 0 && enqueued >= maxItems) return;
    q.push(fn);
    enqueued += 1;
    void drain();
  }

  async function drain() {
    while (running < concurrency && q.length > 0) {
      const fn = q.shift();
      if (!fn) break;
      running += 1;
      fn()
        .catch(() => {})
        .finally(() => {
          running -= 1;
          void drain();
        });
    }
  }

  function logProgress(force = false) {
    const now = Date.now();
    if (!force && now - lastLog < 2500) return;
    lastLog = now;
    process.stdout.write(
      `\rprocessed=${idx} wrote=${wrote} in_flight=${running} queued=${q.length}           `,
    );
  }

  const p = new Promise((resolve, reject) => {
    const streamer = streamArrayMod.withParserAsStream();
    // Backpressure: pause the source if we get too far ahead.
    const maybePause = () => {
      if (q.length + running > maxQueue) {
        try {
          src.pause();
        } catch {
          /* ignore */
        }
      }
    };
    const maybeResume = () => {
      if (q.length + running < Math.max(10, Math.floor(maxQueue * 0.6))) {
        try {
          src.resume();
        } catch {
          /* ignore */
        }
      }
    };

    streamer.on("data", ({ value }) => {
      idx += 1;
      if (idx <= skip) return;
      if (maxItems >= 0 && enqueued >= maxItems) {
        // Stop reading more input once we've scheduled enough work.
        stopping = true;
        try { src.destroy(); } catch { /* ignore */ }
        try { streamer.destroy(); } catch { /* ignore */ }
        return;
      }
      void enqueue(async () => {
        const imageUrl = value.image || value.image_url || value.img || null;
        const pred = imageUrl
          ? await dominantColorFromImage(String(imageUrl), { size, timeoutMs })
          : null;
        const next = mergeColorFields(value, pred);
        const json = JSON.stringify(next);
        if (!first) out.write(",\n");
        first = false;
        out.write(json);
        wrote += 1;
        logProgress();
        if (wrote % 250 === 0) await sleep(25);
        maybeResume();
      });
      maybePause();
    });
    streamer.on("end", async () => {
      while (running > 0 || q.length > 0) {
        logProgress(true);
        await sleep(200);
      }
      out.write("\n]\n");
      out.end();
      logProgress(true);
      process.stdout.write("\n");
      resolve();
    });
    streamer.on("error", (e) => {
      if (stopping) return resolve();
      reject(e);
    });
    src.pipe(streamer);
  });

  await p;
  console.log("Wrote:", absOut);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

