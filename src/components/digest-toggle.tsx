"use client";

import { useTransition } from "react";
import { toggleEmailDigest } from "@/app/account/digest/actions";

export function DigestToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 rounded-xl border border-white/5 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="text-sm text-zinc-300">
          Email me this recap when email is wired up
        </span>
        <input
          type="checkbox"
          defaultChecked={enabled}
          disabled={pending}
          onChange={(e) => {
            startTransition(async () => {
              await toggleEmailDigest(e.target.checked);
            });
          }}
          className="h-4 w-4 rounded border-white/20"
        />
      </label>
    </div>
  );
}
