import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LabelSchema = z
  .object({
    label: z.string().min(1).max(500),
  })
  .strict();

const PatchSchema = z
  .object({
    label: z.string().min(1).max(500),
  })
  .strict();

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_past_searches")
    .select("id, label, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    if (error.message.includes("user_past_searches") || error.code === "PGRST116") {
      return NextResponse.json({
        error:
          "Past searches are not set up. Run the SQL in supabase/migration_past_searches.sql in your Supabase project, then try again.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = LabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const label = parsed.data.label.trim();
  if (!label) {
    return NextResponse.json({ error: "Empty label" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_past_searches")
    .select("id")
    .eq("user_id", user.id)
    .ilike("label", label)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("user_past_searches")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return NextResponse.json({ id: existing.id, label, updated: true });
  }

  const { data, error } = await supabase
    .from("user_past_searches")
    .insert({
      user_id: user.id,
      label,
      updated_at: new Date().toISOString(),
    })
    .select("id, label, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("user_past_searches") ? 503 : 500 },
    );
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const label = parsed.data.label.trim();

  const { data, error } = await supabase
    .from("user_past_searches")
    .update({
      label,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, label, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_past_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
