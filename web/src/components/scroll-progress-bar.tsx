"use client";

import { useEffect, useState } from "react";

export function ScrollProgressBar() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = Math.max(1, el.scrollHeight - el.clientHeight);
        const next = Math.min(1, Math.max(0, el.scrollTop / max));
        setP(next);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="sku-scroll-progress" aria-hidden>
      <div className="sku-scroll-progress__bar" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

