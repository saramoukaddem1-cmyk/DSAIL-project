"use client";

import { useMemo } from "react";

function hash01(s: string, salt: number) {
  let h = salt;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

const PILL_THEMES: { bg: string; shadow: string }[] = [
  {
    bg: "linear-gradient(135deg, #F77A32 0%, #F89465 55%, #E7957F 100%)",
    shadow: "0 8px 28px -4px rgba(247, 122, 50, 0.55)",
  },
  {
    bg: "linear-gradient(135deg, #C5A7EB 0%, #C0A0DC 50%, #C89DC4 100%)",
    shadow: "0 8px 28px -4px rgba(197, 167, 235, 0.55)",
  },
  {
    bg: "linear-gradient(135deg, #6FA6DB 0%, #5D94C9 45%, #4A7FB4 100%)",
    shadow: "0 8px 28px -4px rgba(74, 127, 180, 0.5)",
  },
  {
    bg: "linear-gradient(135deg, #8EEA6A 0%, #6DFF2E 40%, #A7D8A1 100%)",
    shadow: "0 8px 28px -4px rgba(109, 255, 46, 0.35)",
  },
  {
    bg: "linear-gradient(135deg, #9ED3C2 0%, #8FC8D8 50%, #C5A7EB 100%)",
    shadow: "0 8px 28px -4px rgba(143, 200, 216, 0.45)",
  },
  {
    bg: "linear-gradient(135deg, #E7957F 0%, #C89DC4 50%, #6FA6DB 100%)",
    shadow: "0 8px 28px -4px rgba(200, 157, 196, 0.5)",
  },
];

export function BrandConstellation({ brands }: { brands: string[] }) {
  const items = useMemo(() => {
    const list = brands.slice(0, 36);
    return list.map((name, i) => {
      const t = i / Math.max(list.length, 1);
      const angle = t * Math.PI * 2 * 1.72 + 0.4;
      const r = 34 + hash01(name, i) * 18;
      const x = 50 + r * Math.cos(angle);
      const y = 50 + r * Math.sin(angle) * 0.92;
      const delay = hash01(name, 7) * 4;
      const duration = 4 + hash01(name, 3) * 3;
      const theme = PILL_THEMES[i % PILL_THEMES.length];
      return { name, x, y, delay, duration, theme };
    });
  }, [brands]);

  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/50 bg-white/35 shadow-[0_24px_80px_-24px_rgba(247,122,50,0.35),0_24px_80px_-20px_rgba(197,167,235,0.35)] backdrop-blur-xl">
      {/* Mesh wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 70% at 12% 20%, rgba(247, 122, 50, 0.35), transparent 55%), radial-gradient(ellipse 80% 65% at 88% 15%, rgba(197, 167, 235, 0.4), transparent 52%), radial-gradient(ellipse 55% 50% at 70% 85%, rgba(109, 255, 46, 0.2), transparent 50%), radial-gradient(ellipse 60% 45% at 8% 88%, rgba(74, 127, 180, 0.28), transparent 52%), linear-gradient(165deg, rgba(255,255,255,0.5) 0%, rgba(255,250,252,0.2) 100%)",
        }}
      />
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(26,20,32,0.12) 1px, transparent 1px)`,
          backgroundSize: "14px 14px",
        }}
      />
      {/* Vertical stripe accent — graphic bar like a lookbook spine */}
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-3 flex-col sm:w-4"
        aria-hidden
      >
        <div className="min-h-0 flex-1 bg-[#F77A32]" />
        <div className="min-h-0 flex-1 bg-[#F89465]" />
        <div className="min-h-0 flex-1 bg-[#C5A7EB]" />
        <div className="min-h-0 flex-1 bg-[#8EEA6A]" />
        <div className="min-h-0 flex-1 bg-[#6FA6DB]" />
      </div>

      <p className="relative z-10 px-6 pt-8 text-center text-[10px] font-semibold uppercase tracking-[0.55em] text-[#3d3550]">
        Neural style core
      </p>

      <div className="relative z-10 mx-auto mt-3 aspect-[5/4] max-h-[min(72vh,520px)] w-full max-w-lg px-4 pb-8 sm:aspect-square sm:max-h-[min(68vh,480px)]">
        {items.map((item) => (
          <span
            key={item.name}
            className="absolute z-30 max-w-[min(44%,150px)] truncate rounded-full px-3 py-1.5 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)] ring-1 ring-white/25 backdrop-blur-[2px] sm:max-w-[min(40%,160px)] sm:px-3.5 sm:py-2 sm:text-[10px]"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: "translate(-50%, -50%)",
              background: item.theme.bg,
              boxShadow: item.theme.shadow,
              animation: `smouk-float ${item.duration}s ease-in-out ${item.delay}s infinite`,
            }}
          >
            {item.name}
          </span>
        ))}

        <div className="absolute inset-0 z-10 flex items-center justify-center pr-3 sm:pr-4">
          <div className="relative flex h-[58%] w-[58%] max-w-[240px] items-center justify-center">
            <div
              className="absolute inset-[-10%] rounded-full border border-dashed border-[#4A7FB4]/30"
              style={{ animation: "smouk-orbit-spin 52s linear infinite" }}
            />
            <div
              className="absolute inset-[-3%] rounded-full border border-[#C5A7EB]/25"
              style={{ animation: "smouk-orbit-spin 34s linear reverse infinite" }}
            />
            <div
              className="absolute inset-[6%] rounded-full opacity-80"
              style={{
                animation: "smouk-pulse-glow 4.5s ease-in-out infinite",
                background:
                  "radial-gradient(circle at 38% 32%, rgba(247,122,50,0.35), transparent 52%), radial-gradient(circle at 62% 68%, rgba(197,167,235,0.38), transparent 50%), radial-gradient(circle at 50% 50%, rgba(109,255,46,0.12), transparent 45%)",
              }}
            />
            <svg
              viewBox="0 0 200 200"
              className="relative h-full w-full drop-shadow-[0_0_32px_rgba(197,167,235,0.45)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <defs>
                <linearGradient id="sku-core" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F77A32" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#C5A7EB" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#6FA6DB" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#8EEA6A" stopOpacity="0.75" />
                </linearGradient>
                <filter id="sku-core-blur" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="100" cy="100" r="80" stroke="url(#sku-core)" strokeWidth="0.5" opacity="0.32" />
              <circle
                cx="100"
                cy="100"
                r="64"
                stroke="url(#sku-core)"
                strokeWidth="1.1"
                opacity="0.5"
                filter="url(#sku-core-blur)"
              />
              <circle cx="100" cy="100" r="50" fill="url(#sku-core)" opacity="0.1" />
              <path
                d="M100 48 L100 152 M48 100 L152 100 M64 64 L136 136 M136 64 L64 136"
                stroke="url(#sku-core)"
                strokeWidth="0.75"
                opacity="0.38"
              />
              <circle
                cx="100"
                cy="100"
                r="30"
                stroke="url(#sku-core)"
                strokeWidth="1.4"
                opacity="0.88"
                filter="url(#sku-core-blur)"
              />
              <circle cx="100" cy="100" r="14" fill="url(#sku-core)" opacity="0.82" />
              <circle cx="100" cy="100" r="5" fill="#fffefb" opacity="0.95" />
            </svg>
          </div>
        </div>
      </div>

      {brands.length === 0 ? (
        <p className="relative z-10 px-8 pb-10 text-center text-sm leading-relaxed text-[#4a4358]">
          Add labels from the wall below — they lock onto your core and steer chat + inspo.
        </p>
      ) : (
        <p className="relative z-10 px-8 pb-10 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-[#6b6580]">
          {brands.length} signal{brands.length === 1 ? "" : "s"} linked
        </p>
      )}
    </div>
  );
}
