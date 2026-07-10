"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { submitSparkProgress } from "@/app/play/actions";
import { sparkShareUrl, SPARK_SHARE_TEXT } from "@/lib/hustle-spark";

export function SparkSharePanel({
  taskId,
  progress,
  target,
  disabled,
  onProgress,
}: {
  taskId: string;
  progress: number;
  target: number;
  disabled: boolean;
  onProgress: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const done = progress >= target;

  function confirmShare() {
    if (disabled || done || pending) return;
    startTransition(async () => {
      const result = await submitSparkProgress(taskId, 1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Share task marked complete!");
      onProgress();
    });
  }

  if (done) {
    return (
      <p className="mt-3 text-center text-xs text-emerald-300">
        Share confirmed ✓
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-500/20 bg-black/30 p-4">
      <p className="text-xs leading-relaxed text-zinc-400">{SPARK_SHARE_TEXT}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={sparkShareUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
        >
          Open X to share
        </a>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={confirmShare}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          I shared it
        </button>
      </div>
    </div>
  );
}
