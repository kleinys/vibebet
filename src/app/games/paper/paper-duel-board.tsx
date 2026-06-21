"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import { FAST_ASSET_ICONS } from "@/lib/fast-assets";
import type { ActivePaperDuel, MyPaperDuel, OpenPaperDuel } from "@/lib/paper-duels";
import { acceptPaperDuel, cancelPaperDuel } from "./actions";

export function PaperDuelBoard({
  openDuels,
  activeDuels,
  myDuels,
  userId,
}: {
  openDuels: OpenPaperDuel[];
  activeDuels: ActivePaperDuel[];
  myDuels: MyPaperDuel[];
  userId: string;
}) {
  return (
    <div className="mt-8 space-y-10">
      {activeDuels.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Live races
          </h2>
          <ul className="mt-3 space-y-2">
            {activeDuels.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/games/paper/${d.id}`}
                  className="block rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 transition hover:border-cyan-400/40"
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {d.creator_name}{" "}
                    <span className="text-zinc-500">vs</span> {d.opponent_name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {FAST_ASSET_ICONS[d.creator_asset]} {d.creator_asset.toUpperCase()} vs{" "}
                    {FAST_ASSET_ICONS[d.opponent_asset]} {d.opponent_asset.toUpperCase()} ·{" "}
                    {d.duration_sec / 60}m · {formatVibe(d.stake)} VIBE each
                  </p>
                  <p className="mt-2 text-xs font-medium text-cyan-300">Watch live →</p>
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
          <p className="mt-3 text-sm text-zinc-500">No open races. Post one above.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openDuels.map((d) => (
              <OpenRow key={d.id} duel={d} userId={userId} />
            ))}
          </ul>
        )}
      </section>

      {myDuels.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your races
          </h2>
          <ul className="mt-3 space-y-2">
            {myDuels.map((d) => (
              <li key={d.id} className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-100">
                      {d.creator_asset.toUpperCase()}
                      {d.opponent_asset ? ` vs ${d.opponent_asset.toUpperCase()}` : " · waiting"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatVibe(d.stake)} VIBE · {d.status}
                      {d.status === "settled" &&
                        d.winner_id &&
                        ` · ${d.winner_id === userId ? "Won" : "Lost"}`}
                    </p>
                  </div>
                  <Link
                    href={`/games/paper/${d.id}`}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpenRow({ duel: d, userId }: { duel: OpenPaperDuel; userId: string }) {
  const [pending, startTransition] = useTransition();
  const isMine = d.creator_id === userId;

  return (
    <li className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">
            {d.creator_name} · long {d.creator_asset.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {d.duration_sec / 60} min race · {formatVibe(d.stake)} VIBE · winner takes{" "}
            {formatVibe(d.stake * 2)}
          </p>
        </div>
        <div className="flex gap-2">
          {isMine ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cancelPaperDuel(d.id);
                  if (r?.error) toast.error(r.error);
                  else toast.success(r?.ok ?? "Cancelled.");
                })
              }
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : (
            <AcceptPaperDuelButton duelId={d.id} pending={pending} />
          )}
        </div>
      </div>
    </li>
  );
}

function AcceptPaperDuelButton({
  duelId,
  pending: externalPending,
}: {
  duelId: string;
  pending: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await acceptPaperDuel(null, fd);
          if (r?.error) toast.error(r.error);
          else toast.success(r?.ok ?? "Race started!");
        });
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="duelId" value={duelId} />
      <select
        name="asset"
        defaultValue="eth"
        className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs"
      >
        <option value="btc">BTC</option>
        <option value="eth">ETH</option>
        <option value="sol">SOL</option>
      </select>
      <button
        type="submit"
        disabled={pending || externalPending}
        className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {pending ? "…" : "Join race"}
      </button>
    </form>
  );
}
