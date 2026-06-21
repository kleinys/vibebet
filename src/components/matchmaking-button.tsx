"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  joinMatchQueue,
  leaveMatchQueue,
  pollMatchmaking,
} from "@/app/games/duels/actions";

export function MatchmakingButton({
  gameKey,
  stakeInputId,
  defaultStake = 100,
}: {
  gameKey: "high_card" | "dice";
  stakeInputId: string;
  defaultStake?: number;
}) {
  const [searching, setSearching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getStake = useCallback(() => {
    const el = document.getElementById(stakeInputId) as HTMLInputElement | null;
    return Number(el?.value ?? defaultStake);
  }, [stakeInputId, defaultStake]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const p = await pollMatchmaking(gameKey, getStake());
      if (p.error) return;
      if ("done" in p && p.done) {
        stopPolling();
        setSearching(false);
        toast.success(p.ok ?? "Match complete!");
      }
    }, 2000);
  }, [gameKey, getStake, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startSearch = async () => {
    setSearching(true);
    const r = await joinMatchQueue(gameKey, getStake());
    if (r.error) {
      toast.error(r.error);
      setSearching(false);
      return;
    }
    if ("ok" in r && r.ok) {
      toast.success(r.ok);
      setSearching(false);
      return;
    }
    toast.message("Searching for opponent…");
    startPolling();
  };

  const cancel = async () => {
    stopPolling();
    await leaveMatchQueue(gameKey);
    setSearching(false);
    toast.message("Left queue");
  };

  return (
    <>
      <button
        type="button"
        disabled={searching}
        onClick={startSearch}
        className="rounded-md border border-sky-500/40 px-4 py-1.5 text-sm text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
      >
        {searching ? "Searching…" : "Find opponent online"}
      </button>
      {searching && (
        <button
          type="button"
          onClick={cancel}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel search
        </button>
      )}
    </>
  );
}
