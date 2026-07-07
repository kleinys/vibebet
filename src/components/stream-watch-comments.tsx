"use client";

import Link from "next/link";
import { useActionState } from "react";
import { postStreamWatchComment, type StreamCommentState } from "@/app/live/watch/actions";
import type { StreamWatchComment } from "@/lib/stream-watch-comments";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function StreamWatchComments({
  provider,
  externalId,
  comments,
  signedIn,
  loginNext,
}: {
  provider: string;
  externalId: string;
  comments: StreamWatchComment[];
  signedIn: boolean;
  loginNext: string;
}) {
  const [state, action, pending] = useActionState<StreamCommentState, FormData>(
    postStreamWatchComment,
    null,
  );

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Stream chat
      </h3>
      <p className="mt-0.5 text-[10px] text-zinc-500">Talk about what&apos;s happening live.</p>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-0.5">
        {comments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-3 text-center text-[11px] text-zinc-500">
            No comments yet. Start the conversation.
          </p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-white/5 bg-black/25 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-sky-300">{c.authorName}</span>
                <span className="text-[9px] text-zinc-600">{formatTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{c.body}</p>
            </div>
          ))
        )}
      </div>

      {signedIn ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="externalId" value={externalId} />
          <input type="hidden" name="loginNext" value={loginNext} />
          <textarea
            name="body"
            required
            maxLength={500}
            rows={2}
            placeholder="What's happening in the stream?"
            className="w-full resize-none rounded-md border border-white/10 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
          />
          {state?.error && (
            <p className="mt-1.5 text-[11px] text-rose-300">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="text-sky-400 hover:underline">
            Sign in
          </Link>{" "}
          to join the chat.
        </p>
      )}
    </div>
  );
}
