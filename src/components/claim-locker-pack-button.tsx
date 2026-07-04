"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimLockerPackButton({
  missingCount,
  eligible,
}: {
  missingCount: number;
  eligible: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!eligible || missingCount <= 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const supabase = createClient();
            const { error: rpcError } = await supabase.rpc("grant_locker_cosmetics");
            if (rpcError) {
              setError(rpcError.message);
              return;
            }
            router.refresh();
          });
        }}
        className="rounded-sm border border-fuchsia-400/40 bg-fuchsia-500/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200 transition hover:bg-fuchsia-500/25 disabled:opacity-50"
      >
        {pending ? "Unlocking…" : `Unlock ${missingCount} locker skins & badges`}
      </button>
      {error && (
        <p className="mt-1 text-[10px] text-rose-300">{error}</p>
      )}
    </div>
  );
}
