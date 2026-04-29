import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  mirrorPortfolioBrandsToPassport,
  replaceUserBrandPortfolio,
} from "@/lib/brand-portfolio-sync";

const BodySchema = z.object({
  brands: z.array(z.string().min(1).max(120)),
});

/**
 * Replaces `user_brand_portfolio` to match `brands` and mirrors into `style_passport.brands`.
 * Used when saving the style passport so the DB portfolio stays aligned.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { error } = await replaceUserBrandPortfolio(
    supabase,
    user.id,
    parsed.data.brands,
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await mirrorPortfolioBrandsToPassport(supabase, user.id);

  return NextResponse.json({ ok: true });
}
