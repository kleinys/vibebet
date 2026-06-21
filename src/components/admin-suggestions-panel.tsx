"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import type { MarketSuggestion } from "@/lib/creator-hub";
import {
  adminRejectSuggestion,
  adminSpawnSuggestion,
} from "@/app/admin/suggestion-actions";

export function AdminSuggestionsPanel({
  suggestions,
}: {
  suggestions: MarketSuggestion[];
}) {
  if (suggestions.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">No pending suggestions.</p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {suggestions.map((s) => (
        <AdminSuggestionRow key={s.id} suggestion={s} />
      ))}
    </ul>
  );
}

function AdminSuggestionRow({ suggestion: s }: { suggestion: MarketSuggestion }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{s.title}</p>
          {s.description && (
            <p className="mt-1 text-xs text-zinc-400">{s.description}</p>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            {CATEGORY_LABELS[s.category]} · {s.yes_label}/{s.no_label} · ▲{" "}
            {s.vote_count} · by {s.display_name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await adminSpawnSuggestion(s.id);
                if (result.error) toast.error(result.error);
                else toast.success("Market spawned!");
              });
            }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            Spawn (500 VIBE)
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await adminRejectSuggestion(s.id);
                if (result.error) toast.error(result.error);
                else toast.success("Rejected.");
              });
            }}
            className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}
