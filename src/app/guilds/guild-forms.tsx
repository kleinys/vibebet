"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { createGuild, disbandGuild, joinGuild, leaveGuild } from "./actions";

export function CreateGuildForm() {
  const [state, action, pending] = useActionState(createGuild, null);

  return (
    <form action={action} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <h2 className="text-sm font-semibold text-emerald-100">Create a guild</h2>
      <p className="mt-1 text-xs text-emerald-200/70">
        One guild per player. Your tag shows on your profile.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Name</span>
          <input
            name="name"
            required
            minLength={3}
            maxLength={40}
            placeholder="Sharp Minds Collective"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Tag (2–5 chars)</span>
          <input
            name="tag"
            required
            minLength={2}
            maxLength={5}
            placeholder="SMND"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm uppercase"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Description (optional)</span>
          <input
            name="description"
            maxLength={200}
            placeholder="We bet smart."
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>
      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create guild"}
      </button>
    </form>
  );
}

export function JoinGuildForm({ defaultSlug }: { defaultSlug?: string }) {
  const [state, action, pending] = useActionState(joinGuild, null);

  return (
    <form action={action} className="rounded-xl border border-white/5 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-semibold text-zinc-100">Join this guild</h2>
      {!defaultSlug && (
        <p className="mt-1 text-xs text-zinc-500">
          Paste the guild slug from your friend (shown on the guild page).
        </p>
      )}
      <label className="mt-4 block">
        {!defaultSlug && <span className="text-xs text-zinc-400">Guild slug</span>}
        <input
          name="slug"
          required
          readOnly={!!defaultSlug}
          defaultValue={defaultSlug}
          placeholder="sharp-minds-abc123"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>
      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join guild"}
      </button>
    </form>
  );
}

export function GuildActions({ role }: { role: string }) {
  const [pending, startTransition] = useTransition();

  if (role === "owner") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Disband guild? All members will be removed.")) return;
          startTransition(async () => {
            const r = await disbandGuild();
            if (r.error) toast.error(r.error);
            else toast.success("Guild disbanded.");
          });
        }}
        className="rounded-md border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
      >
        Disband guild
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await leaveGuild();
          if (r.error) toast.error(r.error);
          else toast.success("Left guild.");
        });
      }}
      className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-50"
    >
      Leave guild
    </button>
  );
}
