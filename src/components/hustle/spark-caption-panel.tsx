"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitSparkProgress } from "@/app/play/actions";
import type { HustleOracleProfile } from "@/lib/hustle/shared";

export function SparkCaptionPanel({
  taskId,
  progress,
  target,
  disabled,
  tierLocked,
  onProgress,
}: {
  taskId: string;
  progress: number;
  target: number;
  disabled: boolean;
  tierLocked: boolean;
  onProgress: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [pending, startTransition] = useTransition();
  const done = progress >= target;

  function submit() {
    if (disabled || tierLocked || done || pending) return;
    if (caption.trim().length < 30) {
      toast.error("Caption must be at least 30 characters");
      return;
    }

    startTransition(async () => {
      const result = await submitSparkProgress(taskId, 1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Caption ${progress + 1}/${target} saved`);
      setCaption("");
      onProgress();
    });
  }

  if (tierLocked) {
    return (
      <p className="mt-3 text-center text-xs text-zinc-500">
        Unlock Flash tier to access this task.
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-3 text-center text-xs text-emerald-300">
        All captions submitted ✓
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-violet-500/20 bg-black/30 p-4">
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        disabled={disabled || pending}
        placeholder={`Product caption ${progress + 1} (30+ chars)`}
        className="w-full rounded-md border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-zinc-500">
          {caption.trim().length} chars · {progress}/{target} done
        </span>
        <button
          type="button"
          disabled={disabled || pending || caption.trim().length < 30}
          onClick={submit}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Submit caption
        </button>
      </div>
    </div>
  );
}
