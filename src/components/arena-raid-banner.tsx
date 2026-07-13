"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { joinArenaRaid } from "@/app/apps/actions";
import type { ArenaRaidState } from "@/lib/arena-raid";
import { formatVibe } from "@/lib/utils";

function ArenaRaidCelebrate({
  reward,
  onDone,
}: {
  reward: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
      <div className="arena-raid-celebrate relative overflow-hidden rounded-2xl border border-rose-500/40 bg-zinc-950 px-10 py-8 text-center shadow-2xl">
        <div className="arena-raid-celebrate__balls pointer-events-none absolute inset-0" aria-hidden>
          {["🔴", "🟣", "🟡", "🔵", "🟢"].map((c, i) => (
            <span key={i} className="arena-raid-celebrate__ball" style={{ left: `${12 + i * 18}%` }}>
              {c}
            </span>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
          Raid complete!
        </p>
        <p className="mt-2 text-2xl font-bold text-zinc-100">
          +{formatVibe(reward)} VIBE
        </p>
        <p className="mt-1 text-xs text-zinc-500">Group Plinko paid out</p>
      </div>
    </div>
  );
}

export function ArenaRaidBanner({
  raid,
  isLoggedIn,
}: {
  raid: ArenaRaidState;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState<number | null>(null);
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
        const reward = r.reward_per_user ?? raid.reward_per_user;
        setCelebrate(reward);
      } else {
        toast.success("Joined raid — waiting for more players");
        router.refresh();
      }
    });
  }

  return (
    <>
      {celebrate != null && (
        <ArenaRaidCelebrate
          reward={celebrate}
          onDone={() => {
            toast.success(`Raid complete! +${formatVibe(celebrate)} VIBE each`);
            setCelebrate(null);
            router.refresh();
          }}
        />
      )}
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
    </>
  );
}
