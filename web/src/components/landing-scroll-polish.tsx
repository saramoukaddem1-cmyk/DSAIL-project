"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef } from "react";
import { SkuPixelLogo } from "@/components/sku-pixel-logo";
import "./landing-scroll-polish.css";

type Dress = {
  n: string;
  b: string;
  p: string;
  skin: string;
  hair: string;
  color: string;
  style: keyof typeof DRESS_SHAPES;
  armsDown: boolean;
};

const DRESSES: Dress[] = [
  { n: "V Neck Rectangle Gown", b: "NORMA KAMALI", p: "$250", skin: "#d4a788", hair: "#d4a050", color: "#0a0a0a", style: "gown", armsDown: true },
  { n: "Halter Fishtail Gown", b: "NORMA KAMALI", p: "$275", skin: "#c89878", hair: "#1a0e08", color: "#0a0a0a", style: "fishtail", armsDown: true },
  { n: "Brina Mini Dress", b: "SUPERDOWN", p: "$68", skin: "#c89878", hair: "#c0a070", color: "#d4b898", style: "mini", armsDown: true },
  { n: "Halter Drape Bias Gown", b: "NORMA KAMALI", p: "$395", skin: "#8a5a3a", hair: "#1a0e08", color: "#f8f5f0", style: "gown", armsDown: true },
  { n: "Katsia Mini Dress", b: "SUPERDOWN", p: "$74", skin: "#8a5a3a", hair: "#1a0e08", color: "#8a6848", style: "mini", armsDown: true },
  { n: "Halter Turtle Fishtail", b: "NORMA KAMALI", p: "$275", skin: "#c89878", hair: "#1a0e08", color: "#d42828", style: "fishtail", armsDown: true },
  { n: "Long Sleeve V Ruffle", b: "NORMA KAMALI", p: "$250", skin: "#c89878", hair: "#3a2a1a", color: "#0a0a0a", style: "mini", armsDown: false },
  { n: "Strapless Fishtail Gown", b: "NORMA KAMALI", p: "$375", skin: "#c89878", hair: "#d4a050", color: "#e848a8", style: "fishtail", armsDown: true },
  { n: "Mock Neck Flared", b: "NORMA KAMALI", p: "$265", skin: "#c89878", hair: "#3a2a1a", color: "#0a0a0a", style: "mini", armsDown: true },
  { n: "Walter Mini Dress", b: "NORMA KAMALI", p: "$295", skin: "#c89878", hair: "#3a2a1a", color: "#e890b8", style: "mini", armsDown: true },
  { n: "Halter Turtle Fishtail", b: "NORMA KAMALI", p: "$275", skin: "#8a5a3a", hair: "#1a0e08", color: "#3a2a1a", style: "fishtail", armsDown: true },
  { n: "Long Sleeve V Ruffle", b: "NORMA KAMALI", p: "$250", skin: "#8a5a3a", hair: "#2a1a0e", color: "#5a3a2a", style: "mini", armsDown: false },
  { n: "Strapless Shirred Gown", b: "NORMA KAMALI", p: "$350", skin: "#8a5a3a", hair: "#1a0e08", color: "#0a0a0a", style: "gown", armsDown: true },
  { n: "Millie Dress", b: "SNDYS", p: "$71", skin: "#c89878", hair: "#3a2a1a", color: "#0a0a0a", style: "mini", armsDown: true },
  { n: "Lottie Dress", b: "SNDYS", p: "$84", skin: "#c89878", hair: "#1a0e08", color: "#e8d4a8", style: "maxi", armsDown: true },
  { n: "Halter Side Slit Gown", b: "NORMA KAMALI", p: "$212", skin: "#d4a788", hair: "#d4a050", color: "#a0c8d8", style: "gown", armsDown: true },
  { n: "Halter Turtleneck Gown", b: "NORMA KAMALI", p: "$113", skin: "#c89878", hair: "#3a2a1a", color: "#d42828", style: "gown", armsDown: true },
  { n: "Maria Gown", b: "NORMA KAMALI", p: "$425", skin: "#c89878", hair: "#3a2a1a", color: "#d8d8d8", style: "gown", armsDown: true },
  { n: "Tie Front Halter Gown", b: "NORMA KAMALI", p: "$275", skin: "#8a5a3a", hair: "#1a0e08", color: "#5a1a28", style: "gown", armsDown: true },
  { n: "Lorelai Maxi Dress", b: "SNDYS", p: "$98", skin: "#8a5a3a", hair: "#1a0e08", color: "#6a3a28", style: "maxi", armsDown: true },
  { n: "Bill Pickleball Bow", b: "NORMA KAMALI", p: "$395", skin: "#c89878", hair: "#3a2a1a", color: "#d42828", style: "mini", armsDown: true },
  { n: "Diana Gown", b: "NORMA KAMALI", p: "$275", skin: "#c89878", hair: "#d4a050", color: "#5a1a28", style: "gown", armsDown: false },
  { n: "Angel Strapless Midi", b: "SNDYS", p: "$94", skin: "#c89878", hair: "#1a0e08", color: "#1a1a4a", style: "maxi", armsDown: true },
  { n: "Leslie Satin Mini", b: "SNDYS", p: "$94", skin: "#c89878", hair: "#d4a050", color: "#0a0a0a", style: "mini", armsDown: true },
  { n: "Calissa Maxi Dress", b: "SNDYS", p: "$145", skin: "#8a5a3a", hair: "#1a0e08", color: "#0a0a0a", style: "maxi", armsDown: false },
  { n: "Deep V Shirred Gown", b: "NORMA KAMALI", p: "$385", skin: "#8a5a3a", hair: "#1a0e08", color: "#2040d0", style: "gown", armsDown: true },
  { n: "Spliced Pickleball", b: "NORMA KAMALI", p: "$295", skin: "#c89878", hair: "#1a0e08", color: "#4a2818", style: "mini", armsDown: false },
  // Demo-friendly: red-forward + ≤ $200 so the landing scroll can light five “gala” picks.
  { n: "Scarlet Bias Midi", b: "SUPERDOWN", p: "$89", skin: "#c89878", hair: "#1a0e08", color: "#b91c1c", style: "maxi", armsDown: true },
  { n: "Crimson Cowl Gown", b: "SNDYS", p: "$165", skin: "#d4a788", hair: "#3a2a1a", color: "#991b1b", style: "gown", armsDown: true },
  { n: "Ruby Slip Midi", b: "SUPERDOWN", p: "$72", skin: "#8a5a3a", hair: "#1a0e08", color: "#dc2626", style: "maxi", armsDown: true },
  { n: "Merlot Halter Mini", b: "SNDYS", p: "$118", skin: "#c89878", hair: "#d4a050", color: "#9f1239", style: "mini", armsDown: true },
  { n: "Cherry Column Gown", b: "NORMA KAMALI", p: "$198", skin: "#c89878", hair: "#1a0e08", color: "#be123c", style: "gown", armsDown: true },
];

const DRESS_SHAPES = {
  gown: { top: 22, width: 32, height: 74, clipPath: "polygon(30% 0%,70% 0%,76% 20%,80% 50%,90% 100%,10% 100%,20% 50%,24% 20%)" },
  fishtail: { top: 22, width: 30, height: 74, clipPath: "polygon(32% 0%,68% 0%,72% 18%,70% 50%,60% 75%,95% 100%,5% 100%,40% 75%,30% 50%,28% 18%)" },
  mini: { top: 22, width: 36, height: 38, clipPath: "polygon(28% 0%,72% 0%,80% 30%,82% 100%,18% 100%,20% 30%)" },
  maxi: { top: 22, width: 30, height: 72, clipPath: "polygon(30% 0%,70% 0%,74% 25%,72% 100%,28% 100%,26% 25%)" },
} as const;

const ROWS = 40;
const COLS = 16;
const CARD_W = 138;
const CARD_H = 224;
const GAP = 6;

/** Unscaled field size in px (used to "cover" the viewport like object-fit: cover). */
const FIELD_PIXEL_W = COLS * CARD_W + (COLS - 1) * GAP;
const FIELD_PIXEL_H = ROWS * CARD_H + (ROWS - 1) * GAP;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Renders a single SKU card (was imperative DOM; now SSR + hydration safe). */
function LscpDressCard({ d }: { d: Dress }) {
  const shape = DRESS_SHAPES[d.style];
  const usd = Number.parseFloat(d.p.replace(/[^\d.]/g, "")) || 0;
  return (
    <div
      className="lscp-sk"
      data-lscp-usd={String(usd)}
      data-lscp-dress-color={d.color}
    >
      <div className="lscp-sk-ph">
        <div className="lscp-sk-iw">
          <div className="lscp-sk-bg" />
          <div className="lscp-sk-model">
            <div
              className="lscp-sk-hair"
              style={{ background: d.hair }}
            />
            <div
              className="lscp-sk-head"
              style={{ background: d.skin }}
            />
            <div
              className="lscp-sk-neck"
              style={{ background: d.skin }}
            />
            <div
              className="lscp-sk-dress"
              style={{
                top: `${shape.top}%`,
                width: `${shape.width}%`,
                height: `${shape.height}%`,
                background: `linear-gradient(180deg,${d.color} 0%,${d.color} 60%,${d.color}dd 100%)`,
                clipPath: shape.clipPath,
              }}
            />
            {d.style === "mini" ? (
              <div
                className="lscp-sk-legs"
                style={{
                  background: d.skin,
                  clipPath: "polygon(20% 0%,80% 0%,72% 100%,28% 100%)",
                  height: "38%",
                }}
              />
            ) : (
              <div
                className="lscp-sk-legs"
                style={{ display: "none" }}
              />
            )}
            <div className="lscp-sk-arms">
              {d.armsDown ? (
                <>
                  <div
                    className="lscp-sk-arm-l"
                    style={{
                      background: d.skin,
                      clipPath: "polygon(30% 0%,70% 0%,75% 100%,25% 100%)",
                    }}
                  />
                  <div
                    className="lscp-sk-arm-r"
                    style={{
                      background: d.skin,
                      clipPath: "polygon(30% 0%,70% 0%,75% 100%,25% 100%)",
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="lscp-sk-tint" />
        <div className="lscp-sk-grad" />
        <div className="lscp-sk-bts">
          <span className="lscp-sk-saved">SAVED</span>
          <span className="lscp-sk-shop">SHOP ITEM</span>
        </div>
      </div>
      <div className="lscp-sk-inf">
        <div className="lscp-sk-b">{d.b}</div>
        <div className="lscp-sk-n">{d.n}</div>
        <div className="lscp-sk-p">{d.p}</div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Red-dominant swatches (for demo “red dress” picks). */
function isRedDressColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return rgb.r > 140 && rgb.r > rgb.g + 25 && rgb.r > rgb.b + 15;
}

function idxToRC(i: number): { r: number; c: number } {
  return { r: Math.floor(i / COLS), c: i % COLS };
}

function gridDistance(i: number, j: number): number {
  const a = idxToRC(i);
  const b = idxToRC(j);
  return Math.hypot(a.r - b.r, a.c - b.c);
}

function minDistanceToPicks(i: number, picks: number[]): number {
  if (picks.length === 0) return Number.POSITIVE_INFINITY;
  let m = Number.POSITIVE_INFINITY;
  for (const p of picks) {
    const d = gridDistance(i, p);
    if (d < m) m = d;
  }
  return m;
}

/** Number of grid tiles highlighted during the demo scroll. */
const GEM_COUNT = 10;

/** Card indices whose center lies inside the stage (after transforms). */
function indicesVisibleInStage(
  cards: HTMLDivElement[],
  stage: HTMLElement,
  marginFrac: number,
): number[] {
  const sr = stage.getBoundingClientRect();
  const m = marginFrac;
  const left = sr.left + sr.width * m;
  const right = sr.right - sr.width * m;
  const top = sr.top + sr.height * m;
  const bottom = sr.bottom - sr.height * m;
  const out: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i]!.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    if (cx >= left && cx <= right && cy >= top && cy <= bottom) out.push(i);
  }
  return out;
}

/**
 * Spread picks across `candidate` indices (far apart on the grid).
 * Prefers red / ≤ $200 when the candidate pool has enough; fills from all cards if needed.
 */
function pickSpreadFromCandidateIndices(
  cards: HTMLDivElement[],
  candidates: number[],
  count: number,
): number[] {
  const preferred: number[] = [];
  const rest: number[] = [];
  for (const i of candidates) {
    const el = cards[i];
    if (!el) continue;
    const usd = Number.parseFloat(el.dataset.lscpUsd ?? "99999");
    const hex = el.dataset.lscpDressColor ?? "";
    if (usd > 0 && usd <= 200 && isRedDressColor(hex)) preferred.push(i);
    else rest.push(i);
  }

  const pool = preferred.length >= count ? preferred : [...preferred, ...rest];
  if (pool.length < count) {
    for (let i = 0; i < cards.length && pool.length < count; i++) {
      if (!pool.includes(i)) pool.push(i);
    }
  }

  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  const distCenter = (i: number) => {
    const { r, c } = idxToRC(i);
    return Math.hypot(c - cx, r - cy);
  };

  const picks: number[] = [];
  const used = new Set<number>();

  let best0 = -1;
  let best0Score = -1;
  for (const i of pool) {
    const score = distCenter(i);
    if (score > best0Score) {
      best0Score = score;
      best0 = i;
    }
  }
  if (best0 >= 0) {
    picks.push(best0);
    used.add(best0);
  }

  while (picks.length < count) {
    let best = -1;
    let bestMin = -1;
    for (const i of pool) {
      if (used.has(i)) continue;
      const d = minDistanceToPicks(i, picks);
      if (d > bestMin) {
        bestMin = d;
        best = i;
      }
    }
    if (best < 0) break;
    picks.push(best);
    used.add(best);
  }

  while (picks.length < count) {
    let best = -1;
    let bestMin = -1;
    for (let i = 0; i < cards.length; i++) {
      if (used.has(i)) continue;
      const d = minDistanceToPicks(i, picks);
      if (d > bestMin) {
        bestMin = d;
        best = i;
      }
    }
    if (best < 0) break;
    picks.push(best);
    used.add(best);
  }

  const out = picks.slice(0, count);
  const uniq = [...new Set(out)];
  if (uniq.length < count) {
    for (let i = 0; i < cards.length && uniq.length < count; i++) {
      if (!uniq.includes(i)) uniq.push(i);
    }
  }
  return uniq.slice(0, count);
}

function pickDemoGemIndices(cards: HTMLDivElement[], count: number): number[] {
  const allIdx = cards.map((_, i) => i);
  return pickSpreadFromCandidateIndices(cards, allIdx, count);
}

const DEMO_USER_MSG =
  "I'm looking for a red dress under $200 for a gala — size small.";

const CHAT_SHOW_END = 0.56;
const TYPE_START = 0.34;
const TYPE_END = 0.5;

/** Purple highlights only after the chat demo is gone (brief beat, then gems). */
const GEM_SCROLL_START = CHAT_SHOW_END + 0.02;
const GEM_REVEAL_END = GEM_SCROLL_START + 0.16;
const GEM_HOLD_END = 0.86;

export function LandingScrollPolish() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const vgRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const pgRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatUserRef = useRef<HTMLDivElement | null>(null);
  const chatTypedRef = useRef<HTMLSpanElement | null>(null);
  const chatCursorRef = useRef<HTMLSpanElement | null>(null);
  const lbRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<HTMLParagraphElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  const allCardsRef = useRef<HTMLDivElement[]>([]);
  const gemIndicesRef = useRef<number[]>([]);
  const gemSlotCountRef = useRef<number>(GEM_COUNT);
  const litSetRef = useRef<Set<number>>(new Set());

  const gridDressPool = useMemo(() => {
    const p: Dress[] = [];
    for (let i = 0; i < 30; i++) p.push(...DRESSES);
    return p;
  }, []);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const viewport = viewportRef.current;
    if (!field || !viewport) return;

    const allCards = Array.from(
      field.querySelectorAll<HTMLDivElement>(".lscp-sk"),
    );
    allCardsRef.current = allCards;
    gemSlotCountRef.current = GEM_COUNT;
    gemIndicesRef.current = [];
    litSetRef.current = new Set();
    /** Reset when scrolling back above the gem zone; picks are re-measured from the live viewport. */
    let gemAnchorDone = false;

    const applyFieldTransform = (animScale: number, scrollProg: number) => {
      const el = fieldRef.current;
      const stage = el?.closest(".lscp-stage");
      if (!el || !stage) return;

      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      if (stageW < 1 || stageH < 1) {
        el.style.transform = "translate3d(-50%, -50%, 0)";
        return;
      }

      // Always scale up enough that the grid covers the whole stage (no empty side margins).
      const coverMul =
        Math.max(
          1,
          stageW / (FIELD_PIXEL_W * animScale),
          stageH / (FIELD_PIXEL_H * animScale),
        ) * 1.01;
      const finalScale = animScale * coverMul;

      const scrollableH = Math.max(0, FIELD_PIXEL_H * finalScale - stageH);
      const offsetY = scrollProg * scrollableH;
      el.style.transform = `translate(-50%,-50%) scale(${finalScale}) translateY(${-offsetY / finalScale}px)`;
    };

    const onScroll = () => {
      const sh = viewport.scrollHeight - viewport.clientHeight;
      const s = sh > 0 ? viewport.scrollTop / sh : 0;

      if (pgRef.current) pgRef.current.style.width = `${s * 100}%`;

      if (hintRef.current) {
        if (s > 0.03) hintRef.current.classList.add("lscp-hint--hide");
        else hintRef.current.classList.remove("lscp-hint--hide");
      }

      let animScale: number;
      let scrollProg: number;
      if (s < 0.3) {
        const t = s / 0.3;
        animScale = 1 - ease(t) * 0.08;
        scrollProg = ease(t) * 0.15;
      } else if (s < 0.62) {
        const t = (s - 0.3) / 0.32;
        animScale = 0.92 - ease(t) * 0.6;
        scrollProg = 0.15 + ease(t) * 0.35;
      } else {
        animScale = 0.32;
        scrollProg = 0.5;
      }
      applyFieldTransform(animScale, scrollProg);

      const gemStart = GEM_SCROLL_START;
      const gemRevealEnd = GEM_REVEAL_END;
      const gemHoldEnd = GEM_HOLD_END;
      const allCards = allCardsRef.current;
      const litSet = litSetRef.current;

      if (s < gemStart) gemAnchorDone = false;

      if (s >= gemStart && s < gemHoldEnd && !gemAnchorDone) {
        gemAnchorDone = true;
        const stage = field.closest(".lscp-stage") as HTMLElement | null;
        if (stage && allCards.length > 0) {
          litSet.forEach((gIdx) => {
            if (allCards[gIdx]) allCards[gIdx]!.classList.remove("lscp-sk--gem");
          });
          litSet.clear();
          const vis = indicesVisibleInStage(allCards, stage, 0.05);
          gemIndicesRef.current =
            vis.length >= GEM_COUNT
              ? pickSpreadFromCandidateIndices(allCards, vis, GEM_COUNT)
              : pickDemoGemIndices(allCards, GEM_COUNT);
        }
      }

      const gemIndices = gemIndicesRef.current;
      const nGemSlots = gemSlotCountRef.current;
      const applyLitCount = (shouldLit: number) => {
        for (let i = 0; i < shouldLit; i++) {
          const gIdx = gemIndices[i];
          if (gIdx === undefined) continue;
          if (!litSet.has(gIdx) && allCards[gIdx]) {
            litSet.add(gIdx);
            allCards[gIdx]!.classList.add("lscp-sk--gem");
          }
        }
        for (let i = shouldLit; i < nGemSlots; i++) {
          const gIdx = gemIndices[i];
          if (gIdx === undefined) continue;
          if (litSet.has(gIdx) && allCards[gIdx]) {
            litSet.delete(gIdx);
            allCards[gIdx]!.classList.remove("lscp-sk--gem");
          }
        }
      };

      const clearAllGems = () => {
        litSet.forEach((gIdx) => {
          if (allCards[gIdx]) allCards[gIdx]!.classList.remove("lscp-sk--gem");
        });
        litSet.clear();
      };

      if (s < gemStart || s >= gemHoldEnd) {
        clearAllGems();
      } else if (s < gemRevealEnd) {
        const gt = clamp01((s - gemStart) / (gemRevealEnd - gemStart));
        // `floor(gt * (n + 0.51))` keeps most slots dark until the very end of the band
        // (e.g. only 2 lit for gt ≤ ~0.2 with n = 10). Ceil spreads 1..n evenly across gt.
        const shouldLit =
          gt <= 0 ? 0 : Math.min(nGemSlots, Math.ceil(gt * nGemSlots - 1e-9));
        applyLitCount(shouldLit);
      } else {
        applyLitCount(nGemSlots);
      }

      const chat = chatRef.current;
      if (chat) {
        if (s > TYPE_START && s < CHAT_SHOW_END) {
          chat.classList.add("lscp-chat--visible");
          chat.classList.remove("lscp-chat--gone");
        } else {
          chat.classList.remove("lscp-chat--visible");
        }
        if (s >= CHAT_SHOW_END) chat.classList.add("lscp-chat--gone");
        else chat.classList.remove("lscp-chat--gone");
      }
      if (chatUserRef.current) {
        if (s > TYPE_START && s < CHAT_SHOW_END) chatUserRef.current.classList.add("lscp-chat-line--on");
        else chatUserRef.current.classList.remove("lscp-chat-line--on");
      }

      const tType =
        s <= TYPE_START ? 0 : s >= TYPE_END ? 1 : (s - TYPE_START) / (TYPE_END - TYPE_START);
      const nChar = Math.min(
        DEMO_USER_MSG.length,
        Math.floor(clamp01(tType) * DEMO_USER_MSG.length),
      );
      if (chatTypedRef.current) {
        chatTypedRef.current.textContent = DEMO_USER_MSG.slice(0, nChar);
      }
      if (chatCursorRef.current) {
        const showCursor =
          s > TYPE_START && s < CHAT_SHOW_END && nChar < DEMO_USER_MSG.length;
        chatCursorRef.current.style.opacity = showCursor ? "1" : "0";
      }

      if (s > gemHoldEnd) {
        field.classList.add("lscp-field--dim");
        vgRef.current?.classList.add("lscp-vg--final");
      } else {
        field.classList.remove("lscp-field--dim");
        vgRef.current?.classList.remove("lscp-vg--final");
      }

      if (s > 0.89) {
        lbRef.current?.classList.add("lscp-lb--on");
      } else {
        lbRef.current?.classList.remove("lscp-lb--on");
      }

      if (s > 0.935) {
        tlRef.current?.classList.add("lscp-tl--on");
        ctaRef.current?.classList.add("lscp-hud-cta--on");
      } else {
        tlRef.current?.classList.remove("lscp-tl--on");
        ctaRef.current?.classList.remove("lscp-hud-cta--on");
      }
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    const postLayoutRaf = requestAnimationFrame(() => onScroll());

    return () => {
      cancelAnimationFrame(postLayoutRaf);
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="lscp-root fixed inset-0 z-20 h-[100dvh] w-full min-h-0 bg-transparent">
      <div ref={viewportRef} className="lscp-viewport">
        <div className="lscp-sc">
          <div className="lscp-stage">
            <div className="lscp-bg" />
            <div className="lscp-fw">
              <div
                ref={fieldRef}
                className="lscp-field"
                style={{ width: FIELD_PIXEL_W, height: FIELD_PIXEL_H }}
              >
                {Array.from({ length: ROWS }, (_, r) => (
                  <div key={r} className="lscp-srow">
                    {Array.from({ length: COLS }, (_, c) => {
                      const i = r * COLS + c;
                      const d = gridDressPool[i % gridDressPool.length]!;
                      return <LscpDressCard key={i} d={d} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div ref={vgRef} className="lscp-vg" />
            <div ref={pgRef} className="lscp-pg" />
            <div ref={chatRef} className="lscp-chat-demo">
              <div className="lscp-chat-demo__inner">
                <div className="lscp-chat-demo__head">
                  <SkuPixelLogo className="lscp-chat-demo__logo h-7 w-7 shrink-0 text-white" />
                  <span className="lscp-chat-demo__title">SKU</span>
                  <span className="lscp-chat-demo__badge">Chat</span>
                </div>
                <div ref={chatUserRef} className="lscp-chat-line lscp-chat-line--user">
                  <p className="lscp-chat-demo__label">You</p>
                  <p className="lscp-chat-demo__bubble lscp-chat-demo__bubble--user">
                    <span ref={chatTypedRef} />
                    <span ref={chatCursorRef} className="lscp-chat-cursor" aria-hidden>
                      ▍
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="lscp-hud">
              <div ref={lbRef} className="lscp-lb lscp-hud-inner">
                <div className="flex flex-wrap items-center justify-center gap-[clamp(0.75rem,3vw,1.25rem)]">
                  <SkuPixelLogo className="h-[clamp(2.75rem,9vw,4.25rem)] w-[clamp(2.75rem,9vw,4.25rem)] shrink-0 text-white drop-shadow-[0_4px_32px_rgba(0,0,0,0.35)]" />
                  <h1 className="font-display text-[clamp(2.65rem,9.5vw,4.35rem)] font-bold tracking-[0.22em] text-white drop-shadow-[0_4px_48px_rgba(0,0,0,0.45)]">
                    SKU
                  </h1>
                </div>
                <p ref={tlRef} className="lscp-tl mt-3 w-full max-w-xl text-center sm:text-xl">
                  The future of shopping
                </p>
                <nav
                  ref={ctaRef}
                  className="lscp-hud-cta"
                  aria-label="Sign up or log in"
                >
                  <Link
                    href="/signup"
                    className="rounded-full bg-white px-9 py-3.5 text-sm font-semibold text-[#0b0014] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] transition hover:bg-white/95"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-white/85 underline decoration-white/35 underline-offset-[6px] transition hover:text-white hover:decoration-white/70"
                  >
                    I already have one
                  </Link>
                </nav>
              </div>
            </div>
            <div ref={hintRef} className="lscp-hint">
              <span>Scroll to explore</span>
              <div className="lscp-hint-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
