"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimLockerPackButton({ missingCount }: { missingCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (missingCount <= 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const supabase = createClient();
          await supabase.rpc("grant_locker_cosmetics");
          router.refresh();
        });
      }}
      className="mt-2 rounded-sm border border-fuchsia-400/40 bg-fuchsia-500/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200 transition hover:bg-fuchsia-500/25 disabled:opacity-50"
    >
      {pending ? "Unlocking…" : `Unlock ${missingCount} locker skins & badges`}
    </button>
  );
}
