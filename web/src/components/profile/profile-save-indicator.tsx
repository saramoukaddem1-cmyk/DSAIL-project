"use client";

/**
 * Unified “Saved” / “Saving…” treatment for profile panels — top-right placement in the parent.
 */
export function ProfileSaveIndicator({
  saving,
  error,
  className = "",
}: {
  saving: boolean;
  error: string | null;
  className?: string;
}) {
  if (error) {
    return (
      <p
        className={`text-xs font-medium text-amber-200/95 ${className}`}
        role="alert"
      >
        {error}
      </p>
    );
  }
  if (saving) {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60"
          aria-hidden
        />
        <span className="text-xs text-white/50">Saving…</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/75"
        aria-hidden
      />
      <span className="text-xs text-emerald-200/55">Saved</span>
    </div>
  );
}
