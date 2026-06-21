"use client";

import { useActionState } from "react";
import { LIVE_EVENT_CATEGORIES } from "@/lib/stream-url";
import { createLiveEvent } from "./actions";

export function CreateLiveEventForm() {
  const [state, action, pending] = useActionState(createLiveEvent, null);

  return (
    <form action={action} className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5">
      <h2 className="text-sm font-semibold text-fuchsia-100">Host a live stream</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Paste a YouTube or Twitch link. Viewers watch and bet on a side market you
        resolve when the match ends.
      </p>

      {state?.error && (
        <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Title</span>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Volleyball finals — Team A vs Team B"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Description (optional)</span>
          <textarea
            name="description"
            rows={2}
            placeholder="What's happening? Rules, format, etc."
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Category</span>
          <select
            name="category"
            defaultValue="sports"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            {LIVE_EVENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Starts at (optional)</span>
          <input
            name="startsAt"
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Stream URL</span>
          <input
            name="streamUrl"
            type="url"
            placeholder="YouTube, Twitch, Kick, Vimeo, Facebook Live…"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Betting — side A label</span>
          <input
            name="yesLabel"
            defaultValue="Side A"
            maxLength={32}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Betting — side B label</span>
          <input
            name="noLabel"
            defaultValue="Side B"
            maxLength={32}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>

        <input type="hidden" name="enableBet" value="true" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Go live"}
      </button>
    </form>
  );
}
