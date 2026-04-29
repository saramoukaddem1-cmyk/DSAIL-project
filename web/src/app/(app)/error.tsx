"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-lg font-bold tracking-wide text-[var(--smouk-fg)]">
        Something went wrong
      </h1>
      <p className="text-sm text-[var(--smouk-dim)]">
        {error.message || "Unexpected error while loading this screen."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="sku-btn-primary mx-auto py-3"
      >
        Try again
      </button>
    </div>
  );
}
