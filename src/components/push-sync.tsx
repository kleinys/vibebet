"use client";

import { useEffect } from "react";

/** Delivers pending push jobs when the user opens the app. */
export function PushSync({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    if (!("serviceWorker" in navigator)) return;

    const run = () => {
      void fetch("/api/push/deliver", { method: "POST" }).catch(() => {});
    };

    run();
    const id = window.setInterval(run, 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return null;
}
