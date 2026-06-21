"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createCategoricalMarket,
  type CreateCategoricalState,
} from "./actions";
import { MARKET_CATEGORIES, CATEGORY_LABELS } from "@/lib/supabase/types";

export default function NewCategoricalMarketPage() {
  const [state, formAction, pending] = useActionState<
    CreateCategoricalState,
    FormData
  >(createCategoricalMarket, null);

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/markets/new"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← Binary market
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Create multi-outcome market</h1>
      <p className="mt-1 text-sm text-zinc-400">
        2–8 outcomes. Uses LMSR pricing — great for elections, awards, or
        &ldquo;who wins&rdquo; questions.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <label htmlFor="question" className="block text-sm text-zinc-300">
            Question
          </label>
          <input
            id="question"
            name="question"
            type="text"
            required
            minLength={10}
            maxLength={280}
            placeholder="Who will win the 2028 US presidential election?"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm text-zinc-300">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue="politics"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          >
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="outcomes" className="block text-sm text-zinc-300">
            Outcomes (one per line)
          </label>
          <textarea
            id="outcomes"
            name="outcomes"
            rows={6}
            required
            defaultValue={"Candidate A\nCandidate B\nOther"}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-sm focus:border-fuchsia-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">2–8 unique labels, max 80 chars each.</p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm text-zinc-300">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="subsidy" className="block text-sm text-zinc-300">
            Subsidy (VIBE)
          </label>
          <input
            id="subsidy"
            name="subsidy"
            type="number"
            required
            min={100}
            max={100_000}
            step={50}
            defaultValue={1000}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="closesAt" className="block text-sm text-zinc-300">
            Closes at (optional)
          </label>
          <input
            id="closesAt"
            name="closesAt"
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        {state?.error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create multi-outcome market"}
        </button>
      </form>
    </div>
  );
}
