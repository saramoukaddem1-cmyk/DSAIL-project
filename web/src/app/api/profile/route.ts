import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeStylePassport } from "@/lib/style-passport-normalize";
import type { StylePassport } from "@/types/style-passport";

const UpdateSchema = z.object({
  display_name: z.string().trim().min(0).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  /** Shown on Account tab; stored inside `style_passport`. */
  avatar_url: z.string().trim().max(2000).nullable().optional(),
  style_passport: z.unknown().optional(),
  location_country: z.string().trim().min(2).max(80).nullable().optional(),
  onboarding_dismissed_at: z.string().trim().min(1).nullable().optional(),
  /** One-time welcome modal; set on first interaction after signup. */
  sku_welcome_ack_at: z.string().trim().min(1).nullable().optional(),
  location: z
    .object({
      country: z.string().trim().min(2).max(80),
      address1: z.string().trim().min(1).max(120),
      address2: z.string().trim().max(120).optional().nullable(),
      city: z.string().trim().min(1).max(80),
      region: z.string().trim().max(80).optional().nullable(),
      postal: z.string().trim().min(2).max(20),
    })
    .optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: pfRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, phone, style_passport")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_brand_portfolio")
      .select("brand_name")
      .eq("user_id", user.id),
  ]);

  const passport: StylePassport = normalizeStylePassport(profile?.style_passport ?? {});
  const raw = (profile?.style_passport ?? {}) as Record<string, unknown>;
  const location_country =
    typeof raw.location_country === "string" ? raw.location_country : null;
  const location =
    raw.location && typeof raw.location === "object" && !Array.isArray(raw.location)
      ? (raw.location as Record<string, unknown>)
      : null;
  const onboarding_dismissed_at =
    typeof raw.onboarding_dismissed_at === "string"
      ? raw.onboarding_dismissed_at
      : null;
  const sku_welcome_ack_at =
    typeof raw.sku_welcome_ack_at === "string" ? raw.sku_welcome_ack_at : null;

  return NextResponse.json({
    display_name: profile?.display_name ?? "",
    email: user.email ?? "",
    phone: profile?.phone ?? "",
    user_created_at: user.created_at ?? null,
    style_passport: passport,
    portfolio_brands: (pfRows ?? []).map((r) => r.brand_name as string),
    location_country,
    location,
    onboarding_dismissed_at,
    sku_welcome_ack_at,
    avatar_url: passport.avatar_url ?? null,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.style_passport !== undefined) {
    patch.style_passport = parsed.data.style_passport;
  }

  if (parsed.data.location_country !== undefined) {
    // Keep location in the same JSON blob to avoid DB migrations.
    // (UI treats it as a separate “profile” field.)
    const { data: prof } = await supabase
      .from("profiles")
      .select("style_passport")
      .eq("id", user.id)
      .maybeSingle();
    const raw = (prof?.style_passport ?? {}) as Record<string, unknown>;
    patch.style_passport = {
      ...raw,
      ...(typeof patch.style_passport === "object" && patch.style_passport != null
        ? (patch.style_passport as Record<string, unknown>)
        : {}),
      location_country: parsed.data.location_country,
    };
  }

  if (parsed.data.location !== undefined) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("style_passport")
      .eq("id", user.id)
      .maybeSingle();
    const raw = (prof?.style_passport ?? {}) as Record<string, unknown>;
    patch.style_passport = {
      ...raw,
      ...(typeof patch.style_passport === "object" && patch.style_passport != null
        ? (patch.style_passport as Record<string, unknown>)
        : {}),
      location: parsed.data.location,
      location_country: parsed.data.location.country,
    };
  }

  if (parsed.data.onboarding_dismissed_at !== undefined) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("style_passport")
      .eq("id", user.id)
      .maybeSingle();
    const raw = (prof?.style_passport ?? {}) as Record<string, unknown>;
    patch.style_passport = {
      ...raw,
      ...(typeof patch.style_passport === "object" && patch.style_passport != null
        ? (patch.style_passport as Record<string, unknown>)
        : {}),
      onboarding_dismissed_at: parsed.data.onboarding_dismissed_at,
    };
  }

  if (parsed.data.avatar_url !== undefined) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("style_passport")
      .eq("id", user.id)
      .maybeSingle();
    const r = (prof?.style_passport ?? {}) as Record<string, unknown>;
    patch.style_passport = {
      ...r,
      ...(typeof patch.style_passport === "object" && patch.style_passport != null
        ? (patch.style_passport as Record<string, unknown>)
        : {}),
      avatar_url: parsed.data.avatar_url,
    };
  }

  if (parsed.data.sku_welcome_ack_at !== undefined) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("style_passport")
      .eq("id", user.id)
      .maybeSingle();
    const r = (prof?.style_passport ?? {}) as Record<string, unknown>;
    patch.style_passport = {
      ...r,
      ...(typeof patch.style_passport === "object" && patch.style_passport != null
        ? (patch.style_passport as Record<string, unknown>)
        : {}),
      sku_welcome_ack_at: parsed.data.sku_welcome_ack_at,
    };
  }

  const hasPayload =
    Object.keys(patch).length > 0 ||
    parsed.data.display_name !== undefined ||
    parsed.data.phone !== undefined ||
    parsed.data.avatar_url !== undefined;
  if (!hasPayload) {
    return NextResponse.json({ ok: true });
  }

  const updateRow: Record<string, unknown> = { updated_at: new Date().toISOString() };
  Object.assign(updateRow, patch);
  if (parsed.data.display_name !== undefined) {
    updateRow.display_name = parsed.data.display_name;
  }
  if (parsed.data.phone !== undefined) {
    updateRow.phone = parsed.data.phone;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateRow)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

