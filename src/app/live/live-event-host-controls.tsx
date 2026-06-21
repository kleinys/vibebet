"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setLiveEventStatus } from "./actions";

export function LiveEventHostControls({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  function run(next: "live" | "ended") {
    start(async () => {
      const r = await setLiveEventStatus(eventId, next);
      if (r.error) toast.error(r.error);
      else toast.success(next === "live" ? "You are live!" : "Event ended.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "live" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("live")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Mark live
        </button>
      )}
      {status !== "ended" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("ended")}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-50"
        >
          End event
        </button>
      )}
    </div>
  );
}
