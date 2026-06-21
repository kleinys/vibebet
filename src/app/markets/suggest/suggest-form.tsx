"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORIES,
  type MarketCategory,
} from "@/lib/supabase/types";
import {
  submitMarketSuggestion,
  toggleSuggestionVote,
  type SuggestMarketState,
} from "./actions";
import type { MarketSuggestion } from "@/lib/creator-hub";

export function SuggestMarketForm() {
  const [state, action, pending] = useActionState<SuggestMarketState, FormData>(
    submitMarketSuggestion,
    null,
  );

  return (
    <form action={action} noValidate className="mt-6 space-y-4">
      <div>
        <label htmlFor="title" className="text-xs text-zinc-400">
          Market question
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={10}
          maxLength={200}
          placeholder="Will UFC 312 main event go the distance?"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="description" className="text-xs text-zinc-400">
          Context (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Why this market? Resolution source, date, etc."
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="category" className="text-xs text-zinc-400">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue="other"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c as MarketCategory]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="yesLabel" className="text-xs text-zinc-400">
            Yes label
          </label>
          <input
            id="yesLabel"
            name="yesLabel"
            defaultValue="Yes"
            maxLength={32}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="noLabel" className="text-xs text-zinc-400">
            No label
          </label>
          <input
            id="noLabel"
            name="noLabel"
            defaultValue="No"
            maxLength={32}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state?.error && (
        <p className="text-sm text-red-300">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-300">{state.ok}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit suggestion"}
      </button>
    </form>
  );
}

export function SuggestionVoteButton({
  suggestionId,
  voted,
  voteCount,
}: {
  suggestionId: string;
  voted: boolean;
  voteCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleSuggestionVote(suggestionId);
          if (result.error) toast.error(result.error);
        });
      }}
      className={
        voted
          ? "rounded-md border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-200"
          : "rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-violet-500/30"
      }
    >
      ▲ {voteCount}
    </button>
  );
}

export function SuggestionList({ suggestions }: { suggestions: MarketSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500">
        No suggestions yet. Be the first to propose a market.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className="flex gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-4"
        >
          <SuggestionVoteButton
            suggestionId={s.id}
            voted={s.user_voted ?? false}
            voteCount={s.vote_count}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{s.title}</p>
            {s.description && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                {s.description}
              </p>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              {CATEGORY_LABELS[s.category]} · {s.yes_label}/{s.no_label} · by{" "}
              {s.display_name}
              {s.status === "spawned" && s.market_id && (
                <>
                  {" · "}
                  <a
                    href={`/markets/${s.market_id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    Live market →
                  </a>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
