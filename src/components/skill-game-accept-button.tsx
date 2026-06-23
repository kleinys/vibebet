"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { acceptCheckersGame } from "@/app/games/duels/checkers-actions";
import { acceptChessGame } from "@/app/games/duels/chess-actions";
import { acceptGoGame } from "@/app/games/duels/go-actions";
import { acceptPokerGame } from "@/app/games/duels/poker-actions";
import { acceptShogiGame } from "@/app/games/duels/shogi-actions";
import type { SkillGameKey } from "@/components/skill-game-lobby";

const ACCEPT_ACTIONS: Record<
  SkillGameKey,
  (id: string) => Promise<{ error?: string; ok?: string }>
> = {
  chess: acceptChessGame,
  checkers: acceptCheckersGame,
  go: acceptGoGame,
  shogi: acceptShogiGame,
  poker: acceptPokerGame,
};

export function SkillGameAcceptButton({
  gameKey,
  gameId,
  className = "mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50",
}: {
  gameKey: SkillGameKey;
  gameId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const acceptAction = ACCEPT_ACTIONS[gameKey];

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await acceptAction(gameId);
          if (r.error) toast.error(r.error);
          else {
            toast.success(r.ok ?? "Game started!");
            router.refresh();
          }
        })
      }
      className={className}
    >
      {pending ? "Joining…" : "Accept & play"}
    </button>
  );
}
