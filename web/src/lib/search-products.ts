import { createClient } from "@/lib/supabase/server";

export type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  price_cents: number;
  currency: string;
  sizes: string[] | null;
  image_url: string | null;
  in_stock: boolean;
};

export async function searchProducts(filters: {
  query?: string;
  category?: string;
  maxPriceCents?: number;
  brand?: string;
  limit?: number;
}): Promise<ProductRow[]> {
  const supabase = await createClient();
  const limit = Math.min(filters.limit ?? 12, 50);

  let q = supabase.from("products").select("*").eq("in_stock", true).limit(limit);

  if (filters.category) {
    q = q.ilike("category", filters.category);
  }
  if (filters.brand) {
    q = q.ilike("brand", `%${filters.brand}%`);
  }
  if (filters.maxPriceCents != null) {
    q = q.lte("price_cents", filters.maxPriceCents);
  }
  if (filters.query && filters.query.trim()) {
    const raw = filters.query.trim().replace(/%/g, "");
    const p = `%${raw}%`;
    q = q.or(`title.ilike.${p},description.ilike.${p},brand.ilike.${p}`);
  }

  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) {
    console.error("searchProducts", error);
    return [];
  }

  return (data ?? []) as ProductRow[];
}
