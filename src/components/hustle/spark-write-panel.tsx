"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitSparkProgress } from "@/app/play/actions";
import { countWords } from "@/lib/hustle-spark";

export function SparkWritePanel({
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
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const words = countWords(text);
  const done = progress >= target;

  function submit() {
    if (disabled || done || pending) return;
    if (words < target) {
      toast.error(`Write at least ${target} words (${words} so far)`);
      return;
    }

    startTransition(async () => {
      const result = await submitSparkProgress(taskId, target);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Submission saved!");
      onProgress();
    });
  }

  if (done) {
    return (
      <p className="mt-3 text-center text-xs text-emerald-300">
        Writing task complete ✓
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-500/20 bg-black/30 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || pending}
        rows={5}
        placeholder="What's your side hustle idea? How would you earn your first $10?"
        className="w-full resize-none rounded-md border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/40 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={`text-xs tabular-nums ${words >= target ? "text-emerald-300" : "text-zinc-500"}`}
        >
          {words}/{target} words
        </span>
        <button
          type="button"
          disabled={disabled || pending || words < target}
          onClick={submit}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
