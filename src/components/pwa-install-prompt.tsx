"use client";

import { useEffect, useState } from "react";

export function PwaInstallPrompt({ enabled }: { enabled: boolean }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [enabled]);

  if (!enabled || dismissed || isStandalone || !prompt) return null;

  return (
    <div className="border-b border-fuchsia-500/20 bg-fuchsia-950/40 px-4 py-3 md:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="text-xs text-zinc-300">
          Install Vibebet for a full-screen app experience.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              void prompt.prompt();
              setPrompt(null);
              setDismissed(true);
            }}
            className="rounded-md bg-fuchsia-500 px-3 py-1 text-xs font-medium text-white hover:bg-fuchsia-400"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
