"use client";

import { useActionState, useRef, useEffect } from "react";
import { postComment, type CommentState } from "@/app/markets/[id]/comment-actions";

interface Props {
  marketId: string;
}

export function CommentBox({ marketId }: Props) {
  const [state, action, pending] = useActionState<CommentState, FormData>(
    postComment,
    null,
  );
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.ok && ref.current) ref.current.value = "";
  }, [state]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="marketId" value={marketId} />
      <textarea
        ref={ref}
        name="body"
        rows={2}
        required
        minLength={1}
        maxLength={2000}
        placeholder="What do you think?"
        className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        {state?.error ? (
          <span className="text-xs text-red-300">{state.error}</span>
        ) : (
          <span className="text-xs text-zinc-500">Be civil.</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
