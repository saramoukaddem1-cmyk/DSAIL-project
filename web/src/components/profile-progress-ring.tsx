"use client";

import Link from "next/link";

export function ProfileProgressRing({
  progress01,
  label = "Profile",
  initials = "Me",
}: {
  progress01: number;
  label?: string;
  initials?: string;
}) {
  const p = Number.isFinite(progress01) ? Math.min(1, Math.max(0, progress01)) : 0;
  const deg = Math.round(p * 360);
  return (
    <Link
      href="/profile"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#0b0014] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-neutral-50"
      title={label}
      aria-label={label}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(rgba(37,99,235,0.9) 0deg ${deg}deg, rgba(0,0,0,0.06) ${deg}deg 360deg)`,
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
      />
      <span className="relative text-sm font-semibold">{initials}</span>
    </Link>
  );
}

