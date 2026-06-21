"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import type { MyDuel, OpenDuel, SpectatorDuel } from "@/lib/duels";
import { acceptDuel, cancelDuel, declineDuel } from "./actions";

export function DuelBoard({
  openDuels,
  myDuels,
  spectatorDuels,
  userId,
}: {
  openDuels: OpenDuel[];
  myDuels: MyDuel[];
  spectatorDuels: SpectatorDuel[];
  userId: string;
}) {
  return (
    <div className="mt-8 space-y-10">
      {spectatorDuels.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Watch &amp; bet — live duels
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Spectator markets resolve when the underlying market settles.
          </p>
          <ul className="mt-3 space-y-2">
            {spectatorDuels.map((d) => (
              <li
                key={d.duel_id}
                className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm"
              >
                <p className="font-medium text-zinc-100">
                  {d.challenger_name}{" "}
                  <span className="text-zinc-500">vs</span> {d.opponent_name}
                </p>
                <p className="mt-1 text-zinc-400">{d.market_question}</p>
                <p className="mt-2 text-xs text-amber-200">
                  Duel stake: {formatVibe(d.stake)} VIBE each
                </p>
                <Link
                  href={`/duels/${d.duel_id}`}
                  className="mt-3 inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
                >
                  Watch &amp; bet →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Open challenges
        </h2>
        {openDuels.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No open duels. Post one below — anyone can accept open challenges.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openDuels.map((d) => (
              <OpenDuelRow key={d.id} duel={d} userId={userId} />
            ))}
          </ul>
        )}
      </section>

      {myDuels.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your duels
          </h2>
          <ul className="mt-3 space-y-2">
            {myDuels.map((d) => (
              <MyDuelRow key={d.id} duel={d} userId={userId} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpenDuelRow({ duel: d, userId }: { duel: OpenDuel; userId: string }) {
  const [pending, startTransition] = useTransition();
  const isMine = d.challenger_id === userId;
  const canAccept =
    !isMine &&
    (d.opponent_id === null || d.opponent_id === userId);

  return (
    <li className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">
            {d.challenger_name} bets{" "}
            <span className="text-fuchsia-300">{d.challenger_side.toUpperCase()}</span>
          </p>
          <p className="mt-1 text-zinc-400">
            <Link href={`/markets/${d.market_id}`} className="hover:text-fuchsia-300">
              {d.market_question}
            </Link>
          </p>
          <p className="mt-2 text-xs text-amber-200">
            Stake: {formatVibe(d.stake)} VIBE · Winner takes {formatVibe(d.stake * 2)}
          </p>
          <Link
            href={`/duels/${d.id}`}
            className="mt-2 inline-block text-xs font-medium text-violet-400 hover:underline"
          >
            View duel →
          </Link>
          {d.opponent_name && (
            <p className="mt-1 text-xs text-zinc-500">Invited: @{d.opponent_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isMine && (
            <ActionButton
              label="Cancel"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cancelDuel(d.id);
                  if (r.error) toast.error(r.error);
                  else toast.success("Duel cancelled, stake refunded.");
                })
              }
            />
          )}
          {canAccept && (
            <ActionButton
              label="Accept"
              primary
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await acceptDuel(d.id);
                  if (r.error) toast.error(r.error);
                  else toast.success("Duel accepted! Opposite side locked.");
                })
              }
            />
          )}
          {d.opponent_id === userId && !isMine && (
            <ActionButton
              label="Decline"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await declineDuel(d.id);
                  if (r.error) toast.error(r.error);
                  else toast.success("Duel declined.");
                })
              }
            />
          )}
        </div>
      </div>
    </li>
  );
}

function MyDuelRow({ duel: d, userId }: { duel: MyDuel; userId: string }) {
  const won = d.winner_id === userId;
  return (
    <li className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">
            vs {d.opponent_name ?? d.challenger_name}
          </p>
          <p className="mt-1 text-zinc-400">{d.market_question}</p>
          <p className="mt-2 text-xs text-zinc-500">
            {formatVibe(d.stake)} VIBE · {d.status}
            {d.status === "settled" && (
              <span className={won ? " text-emerald-300" : " text-rose-300"}>
                {" "}
                · {won ? "Won" : "Lost"}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link
            href={`/markets/${d.market_id}`}
            className="text-xs text-fuchsia-400 hover:underline"
          >
            Market →
          </Link>
          {d.spectator_market_id && d.status === "accepted" && (
            <Link
              href={`/markets/${d.spectator_market_id}`}
              className="text-xs text-violet-400 hover:underline"
            >
              Spectator →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  pending,
  primary,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={
        primary
          ? "rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-400 disabled:opacity-50"
          : "rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-50"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
