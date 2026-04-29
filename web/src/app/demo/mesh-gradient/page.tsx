import type { Metadata } from "next";
import Link from "next/link";
import styles from "./mesh-gradient-demo.module.css";

export const metadata: Metadata = {
  title: "Mesh gradient demo — SKU",
  description: "Demo: neon mesh gradient square (reference recreation).",
};

export default function MeshGradientDemoPage() {
  return (
    <div className="relative z-[2] flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex max-w-lg flex-col items-center gap-2 text-center">
        <p className="sku-label text-[var(--smouk-muted)]">Demo only</p>
        <h1 className="sku-page-title">Mesh gradient square</h1>
        <p className="sku-lead">
          CSS radial layers — dark center, perimeter glow (blue / magenta /
          orange / white). The full app uses the same mesh globally.
        </p>
      </div>

      <div
        className={styles.meshSquare}
        role="img"
        aria-label="Neon mesh gradient square demo"
      />

      <Link
        href="/"
        className="text-sm font-medium text-[var(--smouk-dim)] underline-offset-4 transition hover:text-[var(--smouk-fg)] hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
