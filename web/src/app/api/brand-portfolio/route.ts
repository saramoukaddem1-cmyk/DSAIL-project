import { NextResponse } from "next/server";
import { z } from "zod";
import { mirrorPortfolioBrandsToPassport } from "@/lib/brand-portfolio-sync";
import { createClient } from "@/lib/supabase/server";

const PostSchema = z.object({
  brandName: z.string().min(1).max(120),
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
    .from("user_brand_portfolio")
    .select("brand_name")
    .eq("user_id", user.id)
    .order("brand_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const brands = (data ?? []).map((r) => r.brand_name as string);
  return NextResponse.json({ brands });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const brandName = parsed.data.brandName.trim();
  const { error } = await supabase.from("user_brand_portfolio").insert({
    user_id: user.id,
    brand_name: brandName,
  });

  if (error) {
    if (error.code === "23505") {
      await mirrorPortfolioBrandsToPassport(supabase, user.id);
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await mirrorPortfolioBrandsToPassport(supabase, user.id);

  return NextResponse.json({ ok: true });
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
  const brandName = searchParams.get("brandName")?.trim();
  if (!brandName) {
    return NextResponse.json({ error: "brandName required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_brand_portfolio")
    .delete()
    .eq("user_id", user.id)
    .eq("brand_name", brandName);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await mirrorPortfolioBrandsToPassport(supabase, user.id);

  return NextResponse.json({ ok: true });
}
