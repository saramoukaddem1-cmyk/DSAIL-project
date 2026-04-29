import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { withTimeout } from "@/lib/with-timeout";

const COLOR_GROUPS = [
  "black",
  "white",
  "beige",
  "tan",
  "brown",
  "grey",
  "red",
  "pink",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gold",
  "silver",
  "multi",
] as const;

export type PrimaryColorGroup = (typeof COLOR_GROUPS)[number];

const CACHE = new Map<string, { color: PrimaryColorGroup; confidence: number }>();
const MAX_CACHE = 2500;

function cacheGet(key: string) {
  const v = CACHE.get(key);
  if (!v) return null;
  // simple refresh
  CACHE.delete(key);
  CACHE.set(key, v);
  return v;
}

function cacheSet(key: string, value: { color: PrimaryColorGroup; confidence: number }) {
  CACHE.set(key, value);
  if (CACHE.size <= MAX_CACHE) return;
  const first = CACHE.keys().next().value as string | undefined;
  if (first) CACHE.delete(first);
}

function normalizeColorToken(s: string): PrimaryColorGroup | null {
  const t = s.trim().toLowerCase();
  if (t === "gray") return "grey";
  if ((COLOR_GROUPS as readonly string[]).includes(t)) return t as PrimaryColorGroup;
  return null;
}

async function fetchImageAsInlineData(imageUrl: string): Promise<{ mimeType: string; data: string } | null> {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "image/jpeg";
  const ab = await res.arrayBuffer();
  const b64 = Buffer.from(ab).toString("base64");
  return { mimeType: ct.split(";")[0] || "image/jpeg", data: b64 };
}

export async function classifyPrimaryColorGroupFromImage(args: {
  imageUrl: string;
  apiKey: string;
  modelName?: string;
  timeoutMs?: number;
}): Promise<{ color: PrimaryColorGroup; confidence: number } | null> {
  const cached = cacheGet(args.imageUrl);
  if (cached) return cached;

  let inline: { mimeType: string; data: string } | null = null;
  try {
    inline = await withTimeout(
      fetchImageAsInlineData(args.imageUrl),
      args.timeoutMs ?? 6000,
      "fetch product image",
    );
  } catch {
    return null;
  }
  if (!inline) return null;

  const genAI = new GoogleGenerativeAI(args.apiKey);
  const model = genAI.getGenerativeModel({
    model: args.modelName ?? "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          primaryColorGroup: {
            type: SchemaType.STRING,
            description: `One of: ${COLOR_GROUPS.join(", ")}`,
          },
          confidence: {
            type: SchemaType.NUMBER,
            description: "0.0 to 1.0 confidence in the primary color group",
          },
        },
        required: ["primaryColorGroup", "confidence"],
      },
    },
    systemInstruction:
      "You classify the DOMINANT garment color from a product image. Ignore background, model skin, hair, sunglasses, and props. If the garment is clearly multi-color/patterned, use 'multi'. Use 'gold'/'silver' only when it is metallic-looking.",
  });

  let result: Awaited<ReturnType<typeof model.generateContent>> | null = null;
  try {
    result = await withTimeout(
      model.generateContent([
        {
          text:
            "Classify the garment's dominant primary color group from this product image. Return JSON only.",
        },
        { inlineData: inline },
      ]),
      args.timeoutMs ?? 8000,
      "vision color classification",
    );
  } catch {
    // Rate limits / billing issues / network errors should not take down the page.
    return null;
  }
  if (!result) return null;

  try {
    const raw = JSON.parse(result.response.text()) as {
      primaryColorGroup?: unknown;
      confidence?: unknown;
    };
    const color = normalizeColorToken(String(raw.primaryColorGroup ?? ""));
    const confidence = Number(raw.confidence);
    if (!color || !Number.isFinite(confidence)) return null;
    const out = { color, confidence: Math.max(0, Math.min(1, confidence)) };
    cacheSet(args.imageUrl, out);
    return out;
  } catch {
    return null;
  }
}

