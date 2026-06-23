"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FriendChallengeFields } from "@/components/friend-challenge-fields";
import {
  acceptLightningDuel,
  cancelLightningDuel,
  createLightningDuel,
} from "./lightning-actions";

type OpenLightning = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake: number;
  is_friendly?: boolean;
  invited_user_id?: string | null;
  creator_side: string;
  duration_sec: number;
};

export function LightningDuelPanel({
  openDuels,
  userId,
}: {
  openDuels: OpenLightning[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createLightningDuel, null);
  const [side, setSide] = useState<"up" | "down">("up");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-amber-100">Post Lightning duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Pick BTC UP or DOWN. Opponent takes the other side. After 60s, live price vs strike
          decides the winner (90% of pool).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="side"
              value="up"
              checked={side === "up"}
              onChange={() => setSide("up")}
            />
            📈 UP
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="side"
              value="down"
              checked={side === "down"}
              onChange={() => setSide("down")}
            />
            📉 DOWN
          </label>
          <input type="hidden" name="duration" value={60} />
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {createPending ? "Posting…" : "Post duel"}
          </button>
        </div>
        <FriendChallengeFields stakeInputName="stake" />
        {createState?.error && <p className="mt-2 text-xs text-rose-300">{createState.error}</p>}
        {createState?.ok && <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>}
      </form>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Open challenges
        </h3>
        {openDuels.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No open duels — post one above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {openDuels.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
              >
                <span>
                  {d.creator_name}
                  {d.is_friendly ? (
                    <span className="ml-2 text-[10px] text-sky-400">friendly · free</span>
                  ) : (
                    <> · {d.stake} VIBE</>
                  )}
                  {" · BTC "}
                  <strong className="uppercase">{d.creator_side}</strong> ({d.duration_sec}s)
                </span>
                {d.creator_id !== userId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await acceptLightningDuel(d.id);
                        if (r?.error) toast.error(r.error);
                        else if (r?.redirect) window.location.href = r.redirect;
                      })
                    }
                    className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-500"
                  >
                    Take opposite side
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cancelLightningDuel(d.id);
                        if (r.error) toast.error(r.error);
                        else toast.success("Cancelled");
                      })
                    }
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function LightningLiveView({
  duel,
  userId,
}: {
  duel: {
    id: string;
    creator_id: string;
    creator_name: string;
    opponent_id: string | null;
    opponent_name: string | null;
    stake: number;
    creator_side: string;
    status: string;
    strike_price: number | null;
    end_price: number | null;
    winner_id: string | null;
    ends_at: string | null;
    settled_at: string | null;
  };
  userId: string;
}) {
  const [now, setNow] = useState(Date.now());
  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (duel.status !== "active") return;
    const poll = async () => {
      const res = await fetch("/api/games/lightning/tick");
      if (res.ok) {
        const j = (await res.json()) as { price?: number; settled?: boolean };
        if (j.price) setBtcPrice(j.price);
        if (j.settled) window.location.reload();
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [duel.status, duel.id]);

  const endsAt = duel.ends_at ? new Date(duel.ends_at).getTime() : 0;
  const remaining = duel.status === "active" ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const opponentSide = duel.creator_side === "up" ? "down" : "up";
  const isCreator = userId === duel.creator_id;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-amber-100">
            {duel.status === "active" ? `${remaining}s left` : duel.status}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Strike: ${duel.strike_price?.toLocaleString() ?? "—"}
            {btcPrice != null && duel.status === "active" && (
              <> · Now: ${btcPrice.toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="text-right text-sm">
          <p>
            {duel.creator_name}: <strong className="uppercase">{duel.creator_side}</strong>
          </p>
          <p>
            {duel.opponent_name ?? "Opponent"}:{" "}
            <strong className="uppercase">{opponentSide}</strong>
          </p>
        </div>
      </div>

      {duel.status === "settled" && (
        <p className="mt-4 text-sm text-emerald-300">
          Settled at ${duel.end_price?.toLocaleString() ?? "—"}.{" "}
          {duel.winner_id
            ? duel.winner_id === userId
              ? "You won!"
              : "You lost."
            : "Draw — refunded."}
        </p>
      )}

      {duel.status === "active" && (
        <p className="mt-4 text-xs text-zinc-500">
          You bet BTC goes <strong className="uppercase">{isCreator ? duel.creator_side : opponentSide}</strong>.
          Auto-settles when the timer hits zero.
        </p>
      )}
    </div>
  );
}
