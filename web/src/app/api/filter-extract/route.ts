import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";
import {
  defaultChatFilterState,
  extractChatFiltersWithGemini,
  heuristicExtractFiltersFromMessage,
  mergeFilterState,
  type ChatFilterState,
} from "@/lib/chat-filter-state";

const BodySchema = z.object({
  message: z.string().min(1).max(400),
  prev_state: z
    .object({
      category: z.string().nullable(),
      color: z.string().nullable(),
      size: z.string().nullable(),
      budget: z.string().nullable(),
      brand: z.string().nullable(),
      description: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const message = parsed.data.message.trim();
  const prev: ChatFilterState =
    (parsed.data.prev_state as ChatFilterState | undefined) ?? defaultChatFilterState();

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

  const passport: StylePassport = normalizeStylePassport(profile?.style_passport ?? {});

  let state: ChatFilterState = prev;
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const extracted = await extractChatFiltersWithGemini({
        apiKey: geminiKey,
        modelName: process.env.GEMINI_MODEL,
        message,
        prevState: prev,
        passport,
        portfolioBrands,
      });
      state = extracted.state;
    } catch {
      state = prev;
    }
  }

  // Heuristic merge as a safety net (and to improve responsiveness).
  const heur = heuristicExtractFiltersFromMessage(message);
  state = mergeFilterState(state, heur);

  return NextResponse.json({ state });
}

