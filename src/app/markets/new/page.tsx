"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createMarket,
  type CreateMarketState,
} from "./actions";
import { MARKET_CATEGORIES, CATEGORY_LABELS } from "@/lib/supabase/types";

export default function NewMarketPage() {
  const [state, formAction, pending] = useActionState<
    CreateMarketState,
    FormData
  >(createMarket, null);

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/markets"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← Back to markets
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Create a market</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Subsidy seeds the AMM and locks in the pool until resolution. Minimum
        100 VIBE.{" "}
        <Link
          href="/markets/new/categorical"
          className="text-violet-400 hover:underline"
        >
          Multi-outcome
        </Link>
        {" · "}
        <Link
          href="/markets/new/recurring"
          className="text-violet-400 hover:underline"
        >
          Recurring Up/Down
        </Link>
        {" · "}
        <Link
          href="/markets/suggest"
          className="text-violet-400 hover:underline"
        >
          Suggest idea
        </Link>
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
            placeholder="Will the SpaceX Starship reach orbit before Jan 1, 2027?"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Phrase as a yes/no question with a clear resolution date.
          </p>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm text-zinc-300">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue="other"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          >
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="yesLabel" className="block text-sm text-zinc-300">
              YES label
            </label>
            <input
              id="yesLabel"
              name="yesLabel"
              type="text"
              defaultValue="Yes"
              maxLength={32}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="noLabel" className="block text-sm text-zinc-300">
              NO label
            </label>
            <input
              id="noLabel"
              name="noLabel"
              type="text"
              defaultValue="No"
              maxLength={32}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-zinc-500">
          Override the default Yes/No labels — e.g. &ldquo;Up&rdquo; / &ldquo;Down&rdquo;,
          &ldquo;Spain&rdquo; / &ldquo;France&rdquo;, or &ldquo;Trump&rdquo; / &ldquo;Harris&rdquo;.
        </p>

        <div>
          <label htmlFor="description" className="block text-sm text-zinc-300">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
            placeholder="How will this be judged? Include sources."
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
            max={1_000_000}
            step={50}
            defaultValue={500}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Deducted from your VIBE balance. Locked in the pool. Higher subsidy
            = lower price impact per bet.
          </p>
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
          <p className="mt-1 text-xs text-zinc-500">
            No more trades after this time. Leave blank for an open-ended
            market.
          </p>
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
          {pending ? "Creating..." : "Create market"}
        </button>
      </form>
    </div>
  );
}
