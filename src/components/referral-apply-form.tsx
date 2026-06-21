"use client";

import { useActionState } from "react";
import { applyReferralFromForm } from "@/app/invite/actions";
import { cn } from "@/lib/utils";

export function ReferralApplyForm({ className }: { className?: string }) {
  const [state, action, pending] = useActionState(applyReferralFromForm, null);

  return (
    <form action={action} className={cn("rounded-xl border border-white/5 p-5", className)}>
      <h2 className="text-sm font-semibold text-zinc-200">Have a friend&apos;s code?</h2>
      <div className="mt-3 flex gap-2">
        <input
          name="code"
          required
          minLength={4}
          maxLength={12}
          placeholder="ABC12345"
          className="flex-1 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm uppercase"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? "…" : "Apply"}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-xs text-emerald-300">{state.ok}</p>}
    </form>
  );
}
