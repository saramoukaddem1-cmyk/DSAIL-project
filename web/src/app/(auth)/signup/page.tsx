"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupFormState } from "./actions";

const initial: SignupFormState = { error: null, notice: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="sku-page-title">Create your account</h1>
        <p className="sku-lead mt-1">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--smouk-fg)] underline decoration-white/40 underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Name</span>
          <div className="sku-input-wrap">
            <input
              name="displayName"
              type="text"
              required
              className="sku-input px-4 py-3"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Username</span>
          <div className="sku-input-wrap">
            <input
              name="username"
              type="text"
              required
              autoComplete="username"
              minLength={2}
              className="sku-input px-4 py-3"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Email</span>
          <div className="sku-input-wrap">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="sku-input px-4 py-3"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--smouk-fg)]">Phone (optional)</span>
          <div className="sku-input-wrap">
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
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
              required
              autoComplete="new-password"
              minLength={8}
              className="sku-input px-4 py-3"
            />
          </div>
        </label>
        {state.notice ? (
          <p className="rounded-2xl border border-[var(--smouk-accent)]/40 bg-[var(--smouk-accent)]/10 px-4 py-3 text-sm text-[var(--smouk-fg)]">
            {state.notice}
          </p>
        ) : null}
        {state.error ? (
          <p className="text-sm text-red-400/90" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="sku-btn-primary w-full py-3.5">
          {pending ? "Creating…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
