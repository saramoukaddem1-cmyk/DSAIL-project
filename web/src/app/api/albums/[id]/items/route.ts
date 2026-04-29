import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PostBody = z.object({
  like_id: z.string().uuid(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: albumId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { data: alb } = await supabase
    .from("user_albums")
    .select("id")
    .eq("id", albumId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!alb) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }
  const { error } = await supabase.from("user_album_items").insert({
    album_id: albumId,
    like_id: parsed.data.like_id,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: albumId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const likeId = searchParams.get("like_id");
  if (!likeId) {
    return NextResponse.json({ error: "like_id required" }, { status: 400 });
  }
  const { data: alb } = await supabase
    .from("user_albums")
    .select("id")
    .eq("id", albumId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!alb) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }
  const { error } = await supabase
    .from("user_album_items")
    .delete()
    .eq("album_id", albumId)
    .eq("like_id", likeId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
