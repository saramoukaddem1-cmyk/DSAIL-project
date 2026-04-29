"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SkuLanding() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cursorGlowRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroQuery, setHeroQuery] = useState("");
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    // Cursor glow follow (exact behavior)
    let mouseX = 0;
    let mouseY = 0;
    let glowX = 0;
    let glowY = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (cursorGlowRef.current) cursorGlowRef.current.style.opacity = "1";
    };
    const onLeave = () => {
      if (cursorGlowRef.current) cursorGlowRef.current.style.opacity = "0";
    };
    const animate = () => {
      glowX += (mouseX - glowX) * 0.1;
      glowY += (mouseY - glowY) * 0.1;
      if (cursorGlowRef.current) {
        cursorGlowRef.current.style.left = `${glowX}px`;
        cursorGlowRef.current.style.top = `${glowY}px`;
      }
      raf = requestAnimationFrame(animate);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useEffect(() => {
    // Scroll-driven zoom out + nav scrolled state
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setNavScrolled(window.scrollY > 30);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    // Scroll-triggered fade-ins
    const root = rootRef.current;
    if (!root) return;

    const els = Array.from(
      root.querySelectorAll<HTMLElement>(
        ".section-eyebrow, .section-title, .section-sub, .step, .feature, .demo-card",
      ),
    );
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => obs.observe(el));

    root.querySelectorAll<HTMLElement>(".step").forEach((el, i) => {
      el.style.transitionDelay = `${0.1 + i * 0.12}s`;
    });
    root.querySelectorAll<HTMLElement>(".feature").forEach((el, i) => {
      el.style.transitionDelay = `${0.05 + i * 0.1}s`;
    });

    return () => obs.disconnect();
  }, []);

  function runSearch() {
    router.push("/signup");
  }

  return (
    <div ref={rootRef} className="sku-landing">
      <div ref={cursorGlowRef} className="cursor-glow" id="cursorGlow" aria-hidden />

      <nav className={"nav" + (navScrolled ? " scrolled" : "")} id="nav">
        <div className="logo">
          <div className="logo-mark" aria-hidden>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </div>
          <span className="logo-word">SKU</span>
        </div>
        <div className="nav-links">
          <a className="nav-link" href="#how">
            How it works
          </a>
          <a className="nav-link" href="#features">
            Features
          </a>
        </div>
        <div className="nav-cta">
          <Link className="btn-ghost" href="/login">
            Log in
          </Link>
          <Link className="btn-primary" href="/signup">
            Get started
          </Link>
        </div>
      </nav>

      <section ref={heroRef} className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <div className="eyebrow-dot" />
            AI-NATIVE FASHION DISCOVERY
          </div>
          <h1 className="hero-title">
            Shop thousands of SKUs in <em>seconds</em>, in plain <em>English</em>.
          </h1>
          <p className="hero-sub">
            Tell SKU exactly what you&apos;re looking for — color, size, budget — and get it. No filters.
            No scrolling for hours. Just answers.
          </p>

          <div className="hero-search-wrap">
            <div className="hero-search-glow" aria-hidden />
            <div className="hero-search">
              <span className="hero-search-icon" aria-hidden>
                ✦
              </span>
              <input
                className="hero-search-input"
                placeholder="Red dress under $400, size small…"
                id="heroInput"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
              />
              <button type="button" className="hero-search-btn" onClick={runSearch}>
                Search
              </button>
            </div>
          </div>

        </div>

        <div className="scroll-cue">
          <span>Scroll to explore</span>
          <div className="scroll-cue-mouse" />
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-eyebrow">
          <div className="section-eyebrow-line" /> How it works
        </div>
        <h2 className="section-title">
          Three steps. No <em>browsing</em>.
        </h2>
        <p className="section-sub">
          A one-time setup, then fast, repeatable shopping that stays consistent with your preferences.
        </p>
        <div className="steps-grid">
          <div className="step">
            <div className="step-num">01</div>
            <h3>Set your profile</h3>
            <p>
              Add your sizes, budget, and preferred brands. SKU uses this to personalize results across every
              search.
            </p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3>Describe the item</h3>
            <p>
              Write a complete request in plain language — color, fit, occasion, and vibe — the way you&apos;d
              message a stylist.
            </p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3>Review curated results</h3>
            <p>
              Get a ranked grid from trusted shops, already aligned to your constraints, so you can decide quickly.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-eyebrow">
          <div className="section-eyebrow-line" /> What makes SKU different
        </div>
        <h2 className="section-title">
          Built for how you <em>actually</em> shop.
        </h2>
        <p className="section-sub">Filters and infinite scrolls are dead. Here&apos;s what replaces them.</p>

        <div className="features-grid">
          <div className="feature">
            <div className="feature-glow" />
            <div className="feature-icon">✦</div>
            <h3>
              Natural language <em>search.</em>
            </h3>
            <p>
              Stop translating &quot;what you want&quot; into dropdown menus. Type a full thought — &quot;linen midi for
              Capri, size small, under $300&quot; — and SKU understands every word.
            </p>
          </div>
          <div className="feature">
            <div className="feature-glow" />
            <div className="feature-icon">♥</div>
            <h3>
              Taste <em>memory.</em>
            </h3>
            <p>Every like, save, and search teaches SKU more about you. The next search is sharper than the last.</p>
          </div>
          <div className="feature">
            <div className="feature-glow" />
            <div className="feature-icon">⚡</div>
            <h3>
              Fast <em>clarity.</em>
            </h3>
            <p>Get accurate results that match your size, budget, and preferences — without wading through filters.</p>
          </div>
          <div className="feature">
            <div className="feature-glow" />
            <div className="feature-icon">◇</div>
            <h3>
              Cross-store <em>shopping.</em>
            </h3>
            <p>
              SKU pulls from every shop you&apos;d actually buy from — Revolve, Net-a-Porter, Mytheresa, indie labels — and
              ranks them by your taste, not theirs. One search. The whole web.
            </p>
          </div>
        </div>
      </section>

      <section className="section cta" id="cta">
        <div className="cta-bg" aria-hidden />
        <h2>
          Stop scrolling.
          <br />
          Start <em>finding</em>.
        </h2>
        <p>SKU is free.</p>
        <Link className="cta-btn" href="/signup">
          Get early access <span className="cta-btn-arrow">→</span>
        </Link>
      </section>

      <footer>
        <div className="logo" style={{ fontSize: 14 }}>
          <div className="logo-mark" style={{ width: 18, height: 18 }} aria-hidden>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>{" "}
          SKU
        </div>
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
        <div>© 2026</div>
      </footer>
    </div>
  );
}

