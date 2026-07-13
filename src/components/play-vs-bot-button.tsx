"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { playInstantVsBot, type InstantBotKey } from "@/app/games/duels/bot-actions";
import { LuckRevealOverlay } from "@/components/luck-reveal";

export function PlayVsBotButton({
  gameKey,
  moveInputName,
  move,
  onWin,
  luckReveal = false,
}: {
  gameKey: InstantBotKey;
  moveInputName?: string;
  move?: "rock" | "paper" | "scissors";
  onWin?: () => void;
  luckReveal?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<{
    kind: "rps" | "card" | "dice";
    message: string;
    won?: boolean;
  } | null>(null);

  function finishReveal() {
    if (!reveal) return;
    const { message, won } = reveal;
    toast.success(message);
    if (won) onWin?.();
    setReveal(null);
  }

  return (
    <>
      <button
        type="button"
        disabled={pending || reveal != null}
        onClick={() =>
          startTransition(async () => {
            let pickedMove: "rock" | "paper" | "scissors" | undefined = move;
            if (gameKey === "rps" && !pickedMove && moveInputName) {
              const picked = document.querySelector<HTMLInputElement>(
                `input[name="${moveInputName}"]:checked`,
              );
              pickedMove =
                (picked?.value as "rock" | "paper" | "scissors" | undefined) ?? "rock";
            }

            const result = await playInstantVsBot(gameKey, pickedMove);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            const message = result.ok ?? "Done!";
            if (
              luckReveal &&
              (gameKey === "rps" || gameKey === "high_card" || gameKey === "dice")
            ) {
              setReveal({
                kind:
                  gameKey === "rps"
                    ? "rps"
                    : gameKey === "high_card"
                      ? "card"
                      : "dice",
                message,
                won: result.won,
              });
              return;
            }
            toast.success(message);
            if (result.won) onWin?.();
          })
        }
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
      >
        {pending ? "Playing bot…" : "Play vs Bot (free)"}
      </button>
      {reveal && (
        <LuckRevealOverlay
          kind={reveal.kind}
          message={reveal.message}
          onDone={finishReveal}
        />
      )}
    </>
  );
}
