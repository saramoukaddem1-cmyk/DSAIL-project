"use client";

import Link from "next/link";

export function SkuAnimatedLogo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={"logo no-underline " + (className ?? "")}
      aria-label="SKU"
    >
      <div className="logo-mark" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="logo-word">SKU</span>
    </Link>
  );
}

