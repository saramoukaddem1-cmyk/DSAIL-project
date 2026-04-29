"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type PastItem = { id: string; label: string };

function useOnClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el) return;
      const t = e.target as Node | null;
      if (t && el.contains(t)) return;
      onOutside();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, onOutside]);
}

export function PastSearchesDropdown() {
  const pathname = usePathname();
  const isChat = pathname === "/chat";
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useOnClickOutside(rootRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    let a = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/past-searches", { credentials: "include" });
        const j = (await res.json()) as { items?: unknown };
        if (!a) return;
        const next =
          Array.isArray(j.items)
            ? (j.items
                .map((x) => {
                  if (!x || typeof x !== "object") return null;
                  const o = x as { id?: unknown; label?: unknown };
                  const id = o.id == null ? "" : String(o.id);
                  const label = o.label == null ? "" : String(o.label);
                  return id && label ? ({ id, label } satisfies PastItem) : null;
                })
                .filter((x): x is PastItem => Boolean(x)) as PastItem[])
            : [];
        setItems(next);
      } catch {
        if (!a) return;
        setItems([]);
      } finally {
        if (!a) return;
        setLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, [open]);

  const content = useMemo(() => {
    if (loading) return <p className="px-3 py-3 text-xs text-white/45">Loading…</p>;
    if (items.length === 0) {
      return (
        <p className="px-3 py-3 text-sm italic text-white/45">
          Your past searches will appear here
        </p>
      );
    }

    return (
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="group relative">
            {renamingId === it.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") setRenamingId(null);
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const t = draft.trim();
                  if (!t) return;
                  const r = await fetch(`/api/past-searches?id=${encodeURIComponent(it.id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ label: t }),
                  });
                  if (r.ok) {
                    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, label: t } : x)));
                  }
                  setRenamingId(null);
                }}
                onBlur={() => setRenamingId(null)}
                className="w-full rounded-xl border border-[var(--border-hi)] bg-[rgba(20,20,36,0.95)] px-3 py-2 text-sm text-white"
              />
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-white/70 transition hover:bg-white/5 hover:text-white"
                onClick={() => {
                  setOpen(false);
                  const label = it.label.trim();
                  if (!label) return;
                  router.push(`/chat?run=${encodeURIComponent(label)}`);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                <span className="pointer-events-none inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <span
                    className="pointer-events-auto rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    role="button"
                    tabIndex={0}
                    aria-label="Rename"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenamingId(it.id);
                      setDraft(it.label);
                    }}
                  >
                    ✎
                  </span>
                  <span
                    className="pointer-events-auto rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    role="button"
                    tabIndex={0}
                    aria-label="Delete"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const r = await fetch(`/api/past-searches?id=${encodeURIComponent(it.id)}`, {
                        method: "DELETE",
                        credentials: "include",
                      });
                      if (r.ok) setItems((prev) => prev.filter((x) => x.id !== it.id));
                    }}
                  >
                    🗑
                  </span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }, [draft, items, loading, renamingId, router]);

  if (!isChat) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="sku-history-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Past searches"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 8v5l3 2M3.5 12a8.5 8.5 0 101.1-4.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 4v4h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="sku-history-panel" role="menu" aria-label="Past searches">
          <div className="sku-history-panel-head">PAST SEARCHES</div>
          <div className="sku-history-panel-body">{content}</div>
        </div>
      ) : null}
    </div>
  );
}

