"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { playDuelVsBot } from "@/app/games/duels/bot-actions";

export function PlayDuelVsBotButton({
  gameKey,
  stake = 50,
  className = "",
  label = "vs Bot",
}: {
  gameKey: string;
  stake?: number;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const move =
            gameKey === "rps"
              ? (["rock", "paper", "scissors"] as const)[Math.floor(Math.random() * 3)]
              : undefined;
          const result = await playDuelVsBot(gameKey, stake, move);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(result.ok ?? "Done!");
          if ("href" in result && result.href) {
            router.push(result.href);
          } else {
            router.refresh();
          }
        })
      }
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
