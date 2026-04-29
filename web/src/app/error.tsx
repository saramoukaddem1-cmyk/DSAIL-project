"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-lg flex-col justify-center gap-6 px-6 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-white">
        Something went wrong
      </h1>
      <p className="text-sm leading-relaxed text-white/75">
        {error.message || "An unexpected error occurred. You can try again or refresh the page."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0b0014] transition hover:bg-white/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-sm font-medium text-white/85 underline decoration-white/40 underline-offset-4"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
