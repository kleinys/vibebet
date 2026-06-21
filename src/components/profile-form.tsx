"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/account/profile/actions";

export function ProfileForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <label htmlFor="display_name" className="block text-xs text-zinc-400">
        Display name
      </label>
      <input
        id="display_name"
        name="display_name"
        type="text"
        defaultValue={initial}
        maxLength={40}
        required
        className="w-full max-w-sm rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
      />
      <p className="text-[11px] text-zinc-500">
        Shown on comments, leaderboard, and court cases. 2–40 characters.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-fuchsia-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error && (
          <span className="text-xs text-red-300">{state.error}</span>
        )}
        {state?.ok && (
          <span className="text-xs text-emerald-300">{state.ok}</span>
        )}
      </div>
    </form>
  );
}
