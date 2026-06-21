"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signup, type ActionState } from "./actions";

function SignupForm() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref")?.trim().toUpperCase() ?? "";

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signup,
    null,
  );

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold">Create your Vibebet account</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Get <span className="text-amber-300">1,000 VIBE</span> on signup.{" "}
        <Link href="/login" className="text-fuchsia-400 hover:underline">
          Sign in instead
        </Link>
        .
      </p>

      {refCode && (
        <p className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
          Invited with code <span className="font-mono">{refCode}</span>
        </p>
      )}

      <form action={formAction} className="mt-8 space-y-4">
        {refCode && <input type="hidden" name="referralCode" value={refCode} />}

        <div>
          <label htmlFor="displayName" className="block text-sm text-zinc-300">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            minLength={2}
            maxLength={40}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">Minimum 8 characters.</p>
        </div>

        {state?.error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>

        <p className="text-xs text-zinc-500">
          By signing up you agree that VIBE Points and Gems have no cash value
          and cannot be withdrawn, transferred, or refunded.
        </p>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm px-6 py-16 text-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
