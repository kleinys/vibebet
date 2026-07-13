"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinArenaRaid } from "@/app/apps/actions";
import type { ArenaRaidState } from "@/lib/arena-raid";
import { formatVibe } from "@/lib/utils";

export function ArenaRaidBanner({
  raid,
  isLoggedIn,
}: {
  raid: ArenaRaidState;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pct = Math.min(
    100,
    Math.round((raid.participant_count / raid.participant_cap) * 100),
  );

  function onJoin() {
    if (!isLoggedIn) {
      toast.error("Sign in to join the raid");
      return;
    }
    startTransition(async () => {
      const r = await joinArenaRaid();
      if (r.error) toast.error(r.error);
      else if (r.settled) {
        toast.success(
          `Raid complete! +${formatVibe(r.reward_per_user ?? raid.reward_per_user)} VIBE each`,
        );
      } else {
        toast.success("Joined raid — waiting for more players");
      }
      router.refresh();
    });
  }

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
            Arena Raid
          </p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-100">
            Group Plinko — fill the bar, everyone wins
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {raid.participant_count}/{raid.participant_cap} players ·{" "}
            {formatVibe(raid.reward_per_user)} VIBE each when full
          </p>
        </div>
        {!raid.joined && raid.status === "open" && (
          <button
            type="button"
            disabled={pending}
            onClick={onJoin}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {pending ? "Joining…" : "Join raid"}
          </button>
        )}
        {raid.joined && (
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
            You&apos;re in
          </span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
