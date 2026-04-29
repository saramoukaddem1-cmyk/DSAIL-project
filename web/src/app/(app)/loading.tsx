/**
 * Shown while the auth layout resolves — avoids a blank screen on slow Supabase/network.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--smouk-accent)] border-t-transparent"
        aria-hidden
      />
      <p className="text-center text-sm font-medium text-[var(--smouk-muted)]">
        Loading…
      </p>
    </div>
  );
}
