import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
  sort_order: z.number().int().optional(),
});

const PatchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sort_order: z.number().int().optional(),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const includeItems = searchParams.get("include_items") === "1";
  const select = includeItems
    ? "id, name, sort_order, created_at, user_album_items(like_id)"
    : "id, name, sort_order, created_at";
  const { data, error } = await supabase
    .from("user_albums")
    .select(select)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: error.message, albums: [] },
      { status: 500 },
    );
  }
  return NextResponse.json({ albums: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("user_albums")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select("id, name, sort_order, created_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ album: data });
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
  const parsed = z
    .object({
      id: z.string().uuid(),
    })
    .merge(PatchBody)
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { id, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("user_albums")
    .update(rest)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, sort_order, created_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ album: data });
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
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_albums")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
