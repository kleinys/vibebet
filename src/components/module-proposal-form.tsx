"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { submitModuleProposal } from "@/app/apps/actions";

const KINDS = [
  { id: "duel", label: "Duel" },
  { id: "arcade", label: "Arcade" },
  { id: "hustle", label: "Hustle" },
  { id: "market", label: "Market" },
  { id: "watch", label: "Watch" },
] as const;

export function ModuleProposalForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitModuleProposal(formData);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Proposal submitted — pending review");
        router.push("/apps/mine");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 bg-zinc-900/40 p-5">
      <div>
        <label htmlFor="name" className="text-xs font-medium text-zinc-400">
          Module name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={3}
          maxLength={64}
          placeholder="e.g. Blitz Chess Ladder"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="description" className="text-xs font-medium text-zinc-400">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={12}
          maxLength={500}
          rows={3}
          placeholder="What does your module do? Who is it for?"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="text-xs font-medium text-zinc-400">
            Category
          </label>
          <select
            id="kind"
            name="kind"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="icon_emoji" className="text-xs font-medium text-zinc-400">
            Icon emoji
          </label>
          <input
            id="icon_emoji"
            name="icon_emoji"
            defaultValue="📦"
            maxLength={4}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="target_href" className="text-xs font-medium text-zinc-400">
          Deep link path
        </label>
        <input
          id="target_href"
          name="target_href"
          required
          defaultValue="/play?tab=duels"
          pattern="^/.*"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs"
        />
        <p className="mt-1 text-[10px] text-zinc-600">
          Where users land after install — must start with /
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
