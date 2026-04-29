import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDistinctRevolveBrands } from "@/lib/revolve/revolve-catalog";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const all = await getDistinctRevolveBrands();
    const brands = q
      ? all.filter((b) => b.toLowerCase().includes(q))
      : all;
    return NextResponse.json({ brands });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load brands";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
