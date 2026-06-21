"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { acceptConnect4Game } from "./connect4-actions";

export function AcceptConnect4Button({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await acceptConnect4Game(gameId);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Game started!");
            router.refresh();
          }
        })
      }
      className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "Joining…" : "Accept & play"}
    </button>
  );
}
