"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#0b0014] antialiased">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 text-center text-white">
          <h1 className="font-sans text-2xl font-bold">SKU — something broke</h1>
          <p className="text-sm text-white/75">
            {error.message || "A critical error occurred."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mx-auto rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0b0014]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
