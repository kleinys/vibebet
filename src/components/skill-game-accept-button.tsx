"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

export function SkillGameAcceptButton({
  gameId,
  acceptAction,
  className = "mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50",
}: {
  gameId: string;
  acceptAction: (id: string) => Promise<{ error?: string; ok?: string }>;
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
