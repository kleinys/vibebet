"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUsdPrice, formatVibe } from "@/lib/utils";
import { FAST_ASSET_ICONS } from "@/lib/fast-assets";
import type { PaperDuelDetail } from "@/lib/paper-duels";

interface LiveDuelPayload {
  duel: PaperDuelDetail;
  liveCreatorReturn: number | null;
  liveOpponentReturn: number | null;
  prices: { asset: string; price: number }[];
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [sec, setSec] = useState(() =>
    Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setSec(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className={sec <= 30 ? "font-mono text-2xl text-rose-400" : "font-mono text-2xl text-cyan-200"}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function ReturnBadge({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) return null;
  const positive = pct >= 0;
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/60 p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          positive ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {positive ? "+" : ""}
        {pct.toFixed(3)}%
      </p>
    </div>
  );
}

export function PaperDuelLiveView({
  duelId,
  initial,
  userId,
}: {
  duelId: string;
  initial: LiveDuelPayload;
  userId: string | null;
}) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/paper/${duelId}`, { cache: "no-store" });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // ignore
    }
  }, [duelId]);

  useEffect(() => {
    if (data.duel.status !== "active") return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [data.duel.status, refresh]);

  const d = data.duel;
  const creatorRet = d.status === "active" ? data.liveCreatorReturn : d.creator_return_pct;
  const opponentRet = d.status === "active" ? data.liveOpponentReturn : d.opponent_return_pct;
  const leading =
    creatorRet != null && opponentRet != null
      ? creatorRet > opponentRet
        ? "creator"
        : opponentRet > creatorRet
          ? "opponent"
          : "tie"
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cyan-400/90">Return race</p>
          <h1 className="mt-1 text-xl font-semibold">
            {d.creator_name}{" "}
            <span className="text-zinc-500">vs</span> {d.opponent_name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {formatVibe(d.stake)} VIBE each · {d.duration_sec / 60} min ·{" "}
            <span className="capitalize">{d.status}</span>
          </p>
        </div>
        {d.status === "active" && d.ends_at && <Countdown endsAt={d.ends_at} />}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-xl border p-4 ${
            leading === "creator"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-white/5 bg-zinc-900/40"
          }`}
        >
          <p className="text-sm font-medium">{d.creator_name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Long {FAST_ASSET_ICONS[d.creator_asset]} {d.creator_asset.toUpperCase()}
            {d.creator_start_price != null && (
              <> · entry {formatUsdPrice(d.creator_start_price)}</>
            )}
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            leading === "opponent"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-white/5 bg-zinc-900/40"
          }`}
        >
          <p className="text-sm font-medium">{d.opponent_name ?? "Waiting…"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {d.opponent_asset ? (
              <>
                Long {FAST_ASSET_ICONS[d.opponent_asset]} {d.opponent_asset.toUpperCase()}
                {d.opponent_start_price != null && (
                  <> · entry {formatUsdPrice(d.opponent_start_price)}</>
                )}
              </>
            ) : (
              "Pick your asset to join"
            )}
          </p>
        </div>
      </div>

      {(creatorRet != null || opponentRet != null) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReturnBadge pct={creatorRet} label={`${d.creator_name} return`} />
          <ReturnBadge pct={opponentRet} label={`${d.opponent_name ?? "Opponent"} return`} />
        </div>
      )}

      {d.status === "settled" && (
        <p className="mt-6 rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3 text-sm">
          {d.winner_id ? (
            <>
              Winner:{" "}
              <strong className="text-emerald-300">
                {d.winner_id === d.creator_id ? d.creator_name : d.opponent_name}
              </strong>
              {userId === d.winner_id && " — that's you!"}
            </>
          ) : (
            "Tie — stakes refunded."
          )}
        </p>
      )}

      {d.status === "open" && userId && userId !== d.creator_id && (
        <p className="mt-6 text-sm text-zinc-400">
          Join from{" "}
          <Link href="/games/paper" className="text-cyan-400 hover:underline">
            Return Races
          </Link>{" "}
          to start the race.
        </p>
      )}

      <Link href="/games/paper" className="mt-8 inline-block text-xs text-zinc-500 hover:text-zinc-300">
        ← All return races
      </Link>
    </div>
  );
}
