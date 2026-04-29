import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LikeBody = z.object({
  product_id: z.string().min(1).max(200),
  title: z.string().min(0).max(500),
  brand: z.string().nullable().optional(),
  price_text: z.string().nullable().optional(),
  currency: z.string().max(8).optional(),
  image_url: z.string().nullable().optional(),
  buy_url: z.string().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("user_product_likes")
    .select("id, product_id, title, brand, price_text, currency, image_url, buy_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message, likes: [] },
      { status: 500 },
    );
  }
  return NextResponse.json({ likes: data ?? [] });
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
  const parsed = LikeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const p = parsed.data;
  const row = {
    user_id: user.id,
    product_id: p.product_id,
    title: p.title,
    brand: p.brand ?? null,
    price_text: p.price_text ?? null,
    currency: p.currency ?? "USD",
    image_url: p.image_url ?? null,
    buy_url: p.buy_url ?? null,
  };
  const { data: existing } = await supabase
    .from("user_product_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", p.product_id)
    .maybeSingle();
  if (existing?.id) {
    const { data, error } = await supabase
      .from("user_product_likes")
      .update({
        title: row.title,
        brand: row.brand,
        price_text: row.price_text,
        currency: row.currency,
        image_url: row.image_url,
        buy_url: row.buy_url,
      })
      .eq("id", existing.id)
      .select("id, product_id, title, brand, price_text, currency, image_url, buy_url, created_at")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ like: data });
  }
  const { data, error } = await supabase
    .from("user_product_likes")
    .insert(row)
    .select("id, product_id, title, brand, price_text, currency, image_url, buy_url, created_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ like: data });
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
  const productId = searchParams.get("product_id");
  if (id) {
    const { error } = await supabase
      .from("user_product_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else if (productId) {
    const { error } = await supabase
      .from("user_product_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "id or product_id required" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
