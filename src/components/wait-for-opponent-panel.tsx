"use client";

import { useState } from "react";
import { toast } from "sonner";

export function WaitForOpponentPanel({
  gameUrl,
  invitedName,
}: {
  gameUrl: string;
  invitedName?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopied(true);
      toast.success("Link copied — send it to your friend!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link manually.");
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-sky-500/25 bg-sky-500/5 p-5">
      <h2 className="text-sm font-semibold text-sky-100">Waiting for opponent</h2>
      <p className="mt-2 text-sm text-zinc-400">
        {invitedName
          ? `Challenge sent to ${invitedName}. They can accept from this link or Open games on the lobby.`
          : "Share this link so a friend can join. Or post in Open games on the lobby for anyone to join."}
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Tip: challenge by player code on the lobby — they enter your code when posting, or you enter
        theirs when you post.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
          {gameUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
