"use client";

import { useActionState } from "react";
import { setFlag, type ResolveState } from "@/app/admin/actions";

interface Props {
  flagKey: string;
  enabled: boolean;
}

export function FlagToggle({ flagKey, enabled }: Props) {
  const [state, action, pending] = useActionState<ResolveState, FormData>(
    setFlag,
    null,
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="key" value={flagKey} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={`Toggle ${flagKey}`}
        className={
          enabled
            ? "rounded bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
            : "rounded bg-zinc-700/40 px-2.5 py-0.5 text-xs text-zinc-300 ring-1 ring-zinc-700/50 hover:bg-zinc-700/60 disabled:opacity-50"
        }
      >
        {pending ? "..." : enabled ? "enabled" : "disabled"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-300">{state.error}</span>
      )}
    </form>
  );
}
