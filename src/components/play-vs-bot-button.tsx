"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { playInstantVsBot, type InstantBotKey } from "@/app/games/duels/bot-actions";

export function PlayVsBotButton({
  gameKey,
  moveInputName,
  move,
  onWin,
}: {
  gameKey: InstantBotKey;
  moveInputName?: string;
  move?: "rock" | "paper" | "scissors";
  onWin?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          let pickedMove: "rock" | "paper" | "scissors" | undefined = move;
          if (gameKey === "rps" && !pickedMove && moveInputName) {
            const picked = document.querySelector<HTMLInputElement>(
              `input[name="${moveInputName}"]:checked`,
            );
            pickedMove = (picked?.value as "rock" | "paper" | "scissors" | undefined) ?? "rock";
          }

          const result = await playInstantVsBot(gameKey, pickedMove);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(result.ok ?? "Done!");
          if (result.won) onWin?.();
        })
      }
      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
    >
      {pending ? "Playing bot…" : "Play vs Bot (free)"}
    </button>
  );
}
