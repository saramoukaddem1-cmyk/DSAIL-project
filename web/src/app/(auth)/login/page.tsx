"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initial: LoginFormState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="sku-page-title">Log in</h1>
        <p className="sku-lead mt-1">
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--smouk-fg)] underline decoration-white/40 underline-offset-4"
          >
            Create an account
          </Link>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Password</span>
          <div className="sku-input-wrap">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="sku-input px-4 py-3"
            />
          </div>
        </label>
        {state.error ? (
          <p className="text-sm text-red-400/90" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="sku-btn-primary w-full py-3.5">
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
