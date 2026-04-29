/**
 * 5×5 starburst mark: large center, 8 medium inner ring, 12 small outer ring.
 * Use `text-*` or `color` on a parent so `currentColor` matches the surface.
 */
const STEP = 20;
const OFF = 10;
const cx = (col: number) => OFF + col * STEP;
const cy = (row: number) => OFF + row * STEP;

/** Inner ring (Chebyshev distance 1 from center), excluding center */
const INNER: [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 3],
  [3, 1],
  [3, 2],
  [3, 3],
];

/** Outer perimeter: 4 corners + 8 edge cells (not corners, not center column/row) */
const OUTER: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 3],
  [0, 4],
  [1, 0],
  [1, 4],
  [3, 0],
  [3, 4],
  [4, 0],
  [4, 1],
  [4, 3],
  [4, 4],
];

type SkuPixelLogoProps = {
  className?: string;
  /** Subtle staggered pulse; respects prefers-reduced-motion in CSS */
  animated?: boolean;
};

export function SkuPixelLogo({ className, animated = true }: SkuPixelLogoProps) {
  const L = 17;
  const M = 10;
  const T = 6;

  let delayIndex = 0;
  const nextDelay = () => {
    const d = (delayIndex * 0.07).toFixed(2);
    delayIndex += 1;
    return `${d}s`;
  };

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        className={animated ? "sku-pixel-logo-cell" : undefined}
        style={animated ? { animationDelay: nextDelay() } : undefined}
        x={cx(2) - L / 2}
        y={cy(2) - L / 2}
        width={L}
        height={L}
      />
      {INNER.map(([row, col]) => (
        <rect
          key={`${row}-${col}`}
          className={animated ? "sku-pixel-logo-cell" : undefined}
          style={animated ? { animationDelay: nextDelay() } : undefined}
          x={cx(col) - M / 2}
          y={cy(row) - M / 2}
          width={M}
          height={M}
        />
      ))}
      {OUTER.map(([row, col]) => (
        <rect
          key={`o-${row}-${col}`}
          className={animated ? "sku-pixel-logo-cell" : undefined}
          style={animated ? { animationDelay: nextDelay() } : undefined}
          x={cx(col) - T / 2}
          y={cy(row) - T / 2}
          width={T}
          height={T}
        />
      ))}
    </svg>
  );
}
