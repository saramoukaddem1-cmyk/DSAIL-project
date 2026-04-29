import type { AsosProduct } from "@/types/asos";

function formatCategoryPath(cat: string | null | undefined): string | null {
  if (!cat?.trim()) return null;
  const parts = cat.split(">").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 2 ? parts.slice(-2).join(" · ") : parts.join(" · ");
}

export function ProductCards({ products }: { products: AsosProduct[] }) {
  if (!products.length) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <article
          key={p.id}
          className="smouk-card-glow group flex flex-col overflow-hidden rounded-2xl border border-[var(--smouk-border)] bg-[var(--smouk-surface-strong)]"
        >
          <div className="relative aspect-[3/4] overflow-hidden bg-[var(--smouk-bg-elevated)]">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-80" />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3">
            {p.brand ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--smouk-accent)]">
                {p.brand}
              </p>
            ) : null}
            <h3 className="line-clamp-2 text-xs font-medium leading-snug text-[var(--smouk-fg)]">
              {p.name}
            </h3>
            {formatCategoryPath(p.category) ? (
              <p className="line-clamp-1 text-[10px] text-[var(--smouk-dim)]">
                {formatCategoryPath(p.category)}
              </p>
            ) : null}
            {(p.colors?.length || p.colour) ? (
              <p className="text-[10px] text-[var(--smouk-dim)]">
                <span className="font-medium text-[var(--smouk-fg)]">Color</span>{" "}
                {(p.colors?.length ? p.colors : [p.colour]).filter(Boolean).join(", ")}
              </p>
            ) : null}
            {p.sizes?.length ? (
              <p className="line-clamp-2 text-[10px] text-[var(--smouk-dim)]">
                <span className="font-medium text-[var(--smouk-fg)]">Sizes</span>{" "}
                {p.sizes.join(", ")}
              </p>
            ) : null}
            {p.descriptionKeywords ? (
              <p className="line-clamp-2 text-[10px] italic text-[var(--smouk-dim)]">
                {p.descriptionKeywords}
              </p>
            ) : null}
            <p className="mt-auto pt-1 text-sm font-semibold tracking-tight text-[var(--smouk-fg)]">
              {p.priceText || "—"}
            </p>
            {p.buyUrl ? (
              <a
                href={p.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sku-btn-primary mt-2 w-full py-2.5 text-center text-[11px] font-semibold"
              >
                Shop item
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
