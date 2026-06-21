"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import type { CopyableTrade, CopyLeaderRow, FollowingRow } from "@/lib/copy-trading";
import { copyTrade, followTrader, unfollowTrader } from "./actions";

export function CopyTradingBoard({
  following,
  trades,
  leaders,
  userId,
}: {
  following: FollowingRow[];
  trades: CopyableTrade[];
  leaders: CopyLeaderRow[];
  userId: string;
}) {
  return (
    <div className="mt-8 space-y-10">
      <FollowForm />
      {following.length > 0 && <FollowingList rows={following} />}
      <RecentTrades trades={trades} userId={userId} />
      <Leaderboard leaders={leaders} />
    </div>
  );
}

function FollowForm() {
  const [state, action, pending] = useActionState(followTrader, null);

  return (
    <form action={action} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <h2 className="text-sm font-semibold text-cyan-100">Follow a sharp mind</h2>
      <p className="mt-1 text-xs text-cyan-200/70">
        Enter their @username. Enable auto-copy to mirror each bet up to your max stake.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-xs text-zinc-400">Username</span>
          <input
            name="username"
            required
            placeholder="@trader"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Max stake (VIBE)</span>
          <input
            name="maxStake"
            type="number"
            min={10}
            max={10000}
            defaultValue={50}
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
          <input name="autoCopy" type="checkbox" value="on" className="rounded" />
          Auto-copy bets
        </label>
      </div>
      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {pending ? "Following…" : "Follow"}
      </button>
    </form>
  );
}

function FollowingList({ rows }: { rows: FollowingRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Following
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.leader_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-zinc-100">{r.display_name}</span>
              {r.username && (
                <span className="ml-2 text-xs text-zinc-500">@{r.username}</span>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                Max {formatVibe(r.max_stake)} VIBE
                {r.auto_copy ? " · auto-copy on" : " · manual copy"}
                {" · "}
                {r.follower_count} followers
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await unfollowTrader(r.leader_id);
                  if (res.error) toast.error(res.error);
                  else toast.success("Unfollowed.");
                });
              }}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:border-white/20 disabled:opacity-50"
            >
              Unfollow
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentTrades({
  trades,
  userId,
}: {
  trades: CopyableTrade[];
  userId: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Recent bets to copy
      </h2>
      {trades.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No open-market bets yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {trades.map((t) => (
            <CopyTradeRow key={t.trade_id} trade={t} userId={userId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CopyTradeRow({
  trade: t,
  userId,
}: {
  trade: CopyableTrade;
  userId: string;
}) {
  const [stake, setStake] = useState(String(t.stake));
  const [pending, startTransition] = useTransition();
  const isOwn = t.leader_id === userId;

  return (
    <li className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">
            {t.display_name}{" "}
            <span className="text-fuchsia-300">{t.side.toUpperCase()}</span>{" "}
            <span className="text-zinc-500">{formatVibe(t.stake)} VIBE</span>
          </p>
          <Link
            href={`/markets/${t.market_id}`}
            className="mt-1 block text-zinc-400 hover:text-fuchsia-300"
          >
            {t.market_question}
          </Link>
        </div>
        {!isOwn && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={100000}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-24 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs tabular-nums"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await copyTrade(t.trade_id, Number(stake));
                  if (res.error) toast.error(res.error);
                  else toast.success(res.ok ?? "Copied!");
                });
              }}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function Leaderboard({ leaders }: { leaders: CopyLeaderRow[] }) {
  if (leaders.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Most followed
      </h2>
      <ul className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5">
        {leaders.map((l) => (
          <li
            key={l.user_id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-zinc-500">#{l.rank}</span>
            <span className="flex-1 px-3 text-zinc-200">
              {l.display_name}
              {l.username && (
                <span className="ml-1 text-xs text-zinc-500">@{l.username}</span>
              )}
            </span>
            <span className="text-xs text-zinc-500">
              {l.follower_count} followers · {l.copies_received} copies
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
