"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { createStreamWatchBet, type CreateStreamBetState } from "@/app/live/watch/actions";

export function CreateStreamBetForm({
  provider,
  externalId,
  streamTitle,
  signedIn,
  loginNext,
  onCreated,
}: {
  provider: string;
  externalId: string;
  streamTitle: string;
  signedIn: boolean;
  loginNext: string;
  onCreated?: (marketId: string) => void;
}) {
  const [state, action, pending] = useActionState<CreateStreamBetState, FormData>(
    createStreamWatchBet,
    null,
  );

  useEffect(() => {
    if (state?.marketId && onCreated) onCreated(state.marketId);
  }, [state?.marketId, onCreated]);

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
        <p className="text-xs font-semibold text-fuchsia-200">Create a stream bet</p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="text-fuchsia-400 hover:underline">
            Sign in
          </Link>{" "}
          to post a yes/no poll about something that could happen in this stream.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
      <p className="text-xs font-semibold text-fuchsia-200">Create a stream bet</p>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        Ask what might happen next — others vote with VIBE.
      </p>

      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="externalId" value={externalId} />
      <input type="hidden" name="streamTitle" value={streamTitle} />
      <input type="hidden" name="loginNext" value={loginNext} />

      {state?.error && (
        <p className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-200">
          {state.ok}
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-[10px] font-medium text-zinc-400">What could happen?</span>
        <input
          name="question"
          required
          minLength={8}
          maxLength={240}
          placeholder="Will they win this raid before the stream ends?"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-fuchsia-500/50"
        />
      </label>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-medium text-zinc-400">Option A</span>
          <input
            name="yesLabel"
            defaultValue="Yes"
            maxLength={32}
            placeholder="Yes"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium text-zinc-400">Option B</span>
          <input
            name="noLabel"
            defaultValue="No"
            maxLength={32}
            placeholder="No"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-md bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post stream bet"}
      </button>
    </form>
  );
}
