"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { startChessVsBot } from "@/app/games/duels/chess-actions";

export function PlayChessVsBotButton({
  friendly = true,
  stake = 100,
  className = "",
}: {
  friendly?: boolean;
  stake?: number;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startChessVsBot(friendly, stake);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(result.ok ?? "Started!");
          if (result.gameId) router.push(`/games/duels/chess/${result.gameId}`);
          else router.refresh();
        })
      }
      className={
        className ||
        "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
      }
    >
      {pending ? "Starting bot…" : "Play vs Bot"}
    </button>
  );
}
