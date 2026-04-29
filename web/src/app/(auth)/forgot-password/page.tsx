"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initial: ForgotPasswordState = { error: null, notice: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="sku-page-title">Reset password</h1>
        <p className="sku-lead mt-1">
          Enter your email and we’ll send a reset link.
        </p>
      </div>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Email</span>
          <div className="sku-input-wrap">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="sku-input px-4 py-3"
            />
          </div>
        </label>

        {state.notice ? (
          <p className="text-sm text-white/70" role="status">
            {state.notice}
          </p>
        ) : null}
        {state.error ? (
          <p className="text-sm text-red-400/90" role="alert">
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="sku-btn-primary w-full py-3.5">
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-[var(--smouk-fg)] underline decoration-white/40 underline-offset-4"
        >
          Back to log in
        </Link>
      </div>
    </div>
  );
}

