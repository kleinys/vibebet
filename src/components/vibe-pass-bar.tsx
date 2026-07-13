"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissVibePass } from "@/app/psychology/actions";
import type { VibePassProgress } from "@/lib/vibe-pass";

const STORAGE_KEY = "vibebet-vibe-pass-expanded";

export function VibePassBar({ progress }: { progress: VibePassProgress }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!progress.visible) return null;

  const nextStep = progress.steps.find((s) => !s.done);

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissVibePass();
      router.refresh();
    });
  }

  return (
    <div className="border-t border-violet-500/20 bg-gradient-to-r from-violet-950/80 via-zinc-950 to-fuchsia-950/60">
      <div className="mx-auto max-w-6xl px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-expanded={expanded}
          >
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              Vibe Pass
            </span>
            <span className="h-1.5 min-w-[72px] flex-1 max-w-[140px] overflow-hidden rounded-full bg-zinc-800">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-violet-200">
              {progress.percent}%
            </span>
            {!expanded && nextStep && (
              <span className="hidden truncate text-xs text-zinc-400 sm:inline">
                Next: {nextStep.label}
              </span>
            )}
            <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden>
              {expanded ? "▲" : "▼"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={pending}
            className="shrink-0 text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>

        {expanded && (
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {progress.steps.map((step) => (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition ${
                    step.done
                      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200"
                      : "border-white/10 bg-zinc-900/50 text-zinc-300 hover:border-violet-400/30"
                  }`}
                >
                  <span aria-hidden className="mt-0.5 shrink-0">
                    {step.done ? "✓" : "○"}
                  </span>
                  <span>{step.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
