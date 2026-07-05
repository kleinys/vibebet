"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { MatchmakingButton } from "@/components/matchmaking-button";
import { PlayVsBotButton } from "@/components/play-vs-bot-button";
import { WinSharePanel } from "@/components/win-share-panel";
import type { ShareProfile } from "@/lib/share-profile";
import {
  acceptDiceDuel,
  cancelDiceDuel,
  createDiceDuel,
  playCoinFlip,
  playPlinko,
  revealLuckyScratcher,
  spinLuckySlots,
} from "./actions";

export function CoinFlipPanel({ shareProfile }: { shareProfile: ShareProfile }) {
  const [state, action, pending] = useActionState(playCoinFlip, null);

  return (
    <form action={action} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <h2 className="text-sm font-semibold text-amber-100">Coin flip</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Pick heads or tails. Win = 1.8× your stake (10% house edge).
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="side" value="heads" defaultChecked /> Heads
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="side" value="tails" /> Tails
        </label>
        <input
          name="stake"
          type="number"
          min={10}
          max={10000}
          defaultValue={50}
          className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? "Flipping…" : "Flip"}
        </button>
      </div>
      {state?.error && <p className="mt-3 text-xs text-rose-300">{state.error}</p>}
      {state?.result && (
        <p className="mt-3 text-xs text-emerald-300">{state.result}</p>
      )}
      {state?.won && (
        <WinSharePanel
          displayName={shareProfile.displayName}
          username={shareProfile.username}
          headline="Won a coin flip on Vibebet"
        />
      )}
    </form>
  );
}

export function DiceDuelPanel({
  openDuels,
  userId,
  shareProfile,
}: {
  openDuels: {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
  }[];
  userId: string;
  shareProfile: ShareProfile;
}) {
  const [createState, createAction, createPending] = useActionState(createDiceDuel, null);
  const [pending, startTransition] = useTransition();
  const [showWinShare, setShowWinShare] = useState(false);

  return (
    <div className="space-y-4">
      <form
        action={createAction}
        className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-sky-100">Dice duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          2d6 vs 2d6. Winner takes 90% of the pool. Ties reroll once.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            id="dice-stake"
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Post open duel
          </button>
          <MatchmakingButton gameKey="dice" stakeInputId="dice-stake" defaultStake={100} />
          <PlayVsBotButton
            gameKey="dice"
            stakeInputId="dice-stake"
            defaultStake={100}
            onWin={() => setShowWinShare(true)}
          />
        </div>
        {createState?.error && (
          <p className="mt-2 text-xs text-rose-300">{createState.error}</p>
        )}
        {createState?.ok && (
          <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>
        )}
      </form>

      {openDuels.length > 0 && (
        <ul className="space-y-2">
          {openDuels.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
            >
              <p>
                {d.creator_name} · {d.stake} VIBE
              </p>
              {d.creator_id !== userId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await acceptDiceDuel(d.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success(r.ok ?? "Done!");
                        setShowWinShare(!!r.won);
                      }
                    })
                  }
                  className="mt-2 rounded-md bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-500"
                >
                  Roll against them
                </button>
              )}
              {d.creator_id === userId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cancelDiceDuel(d.id);
                      if (r.error) toast.error(r.error);
                      else toast.success("Cancelled");
                    })
                  }
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {showWinShare && (
        <WinSharePanel
          displayName={shareProfile.displayName}
          username={shareProfile.username}
          headline="Won a dice duel on Vibebet"
        />
      )}
    </div>
  );
}

const PLINKO_SLOTS = [0.2, 0.5, 1, 1.5, 3, 1.5, 1, 0.5, 0.2];

export function PlinkoPanel() {
  const [pending, startTransition] = useTransition();
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section
      id="plinko"
      className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5"
    >
      <h2 className="font-[family-name:var(--font-gothic)] text-lg text-fuchsia-100">Plinko</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Drop a chip — weighted slots from safe edges to spicy center jackpots.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          id="plinko-stake"
          type="number"
          min={10}
          max={5000}
          defaultValue={50}
          className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <select
          id="plinko-risk"
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          defaultValue="medium"
        >
          <option value="low">Low risk</option>
          <option value="medium">Medium</option>
          <option value="high">High risk</option>
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const stake = Number(
                (document.getElementById("plinko-stake") as HTMLInputElement)?.value ?? 50,
              );
              const risk = (
                (document.getElementById("plinko-risk") as HTMLSelectElement)?.value ?? "medium"
              ) as "low" | "medium" | "high";
              const r = await playPlinko(stake, risk);
              if (r.error) toast.error(r.error);
              else {
                setLastSlot(r.slot ?? null);
                setMessage(r.ok ?? null);
                toast.success(r.ok ?? "Dropped!");
              }
            })
          }
          className="rounded-md bg-fuchsia-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {pending ? "Dropping…" : "Drop"}
        </button>
      </div>
      <div className="mt-5 flex justify-center gap-1">
        {PLINKO_SLOTS.map((m, i) => (
          <div
            key={m}
            className={`flex h-14 w-9 flex-col items-center justify-end rounded-t-md border border-white/10 pb-1 text-[9px] ${
              lastSlot === i ? "bg-fuchsia-500/40 ring-2 ring-fuchsia-300" : "bg-zinc-900/80"
            }`}
          >
            <span className="text-zinc-400">{m}×</span>
          </div>
        ))}
      </div>
      {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
    </section>
  );
}

export function LuckySlotsPanel({
  pendingTickets,
}: {
  pendingTickets: { id: string; prize: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [reels, setReels] = useState<string[]>(["?", "?", "?"]);
  const [message, setMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState(pendingTickets);

  const spin = () =>
    startTransition(async () => {
      const stake = Number(
        (document.getElementById("slots-stake") as HTMLInputElement)?.value ?? 50,
      );
      const r = await spinLuckySlots(stake);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setReels(r.reels ?? ["7", "7", "7"]);
      setMessage(r.ok ?? null);
      toast.success(r.ok ?? "Spin!");
      if (r.scratcherWon && r.ticketId) {
        setTickets((t) => [{ id: r.ticketId!, prize: 0 }, ...t]);
      }
    });

  const scratch = (ticketId: string) =>
    startTransition(async () => {
      const r = await revealLuckyScratcher(ticketId);
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.ok ?? "Revealed!");
        setTickets((t) => t.filter((x) => x.id !== ticketId));
      }
    });

  return (
    <section
      id="lucky-slots"
      className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5"
    >
      <h2 className="font-[family-name:var(--font-gothic)] text-lg text-rose-100">
        Lucky Slots &amp; Scratchers
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        Spin the reels for line wins. Land triple SCRATCH to earn a scratcher ticket — scratch it
        here for a hidden VIBE prize.
      </p>

      <div className="mt-5 flex justify-center gap-3">
        {reels.map((sym, i) => (
          <div
            key={`${sym}-${i}`}
            className="flex h-20 w-16 items-center justify-center rounded-lg border-2 border-rose-400/40 bg-zinc-950 text-xl font-bold text-rose-100 shadow-inner"
          >
            {sym}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          id="slots-stake"
          type="number"
          min={10}
          max={2000}
          defaultValue={50}
          className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={spin}
          className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {pending ? "Spinning…" : "Spin"}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}

      {tickets.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your scratchers
          </h3>
          <ul className="mt-2 space-y-2">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
              >
                <span className="text-amber-100">🎫 Mystery scratcher</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => scratch(t.id)}
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Scratch
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
