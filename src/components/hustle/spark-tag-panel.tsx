"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitSparkProgress } from "@/app/play/actions";
import { SPARK_TAG_IMAGES, type SparkTagLabel } from "@/lib/hustle-spark";

export function SparkTagPanel({
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
  const [index, setIndex] = useState(Math.min(progress, SPARK_TAG_IMAGES.length - 1));
  const [pending, startTransition] = useTransition();
  const image = SPARK_TAG_IMAGES[index];
  const done = progress >= target;

  function pick(label: SparkTagLabel) {
    if (disabled || done || pending || !image) return;
    const correct = label === image.label;

    startTransition(async () => {
      if (!correct) {
        toast.error("Wrong tag — try again!");
        return;
      }
      const result = await submitSparkProgress(taskId, 1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Tagged ${progress + 1}/${target}`);
      onProgress();
      setIndex((i) => Math.min(i + 1, SPARK_TAG_IMAGES.length - 1));
    });
  }

  if (done) {
    return (
      <p className="mt-3 text-center text-xs text-emerald-300">
        All images tagged ✓
      </p>
    );
  }

  if (!image) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-500/20 bg-black/30 p-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-6xl" aria-hidden>
          {image.emoji}
        </span>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{image.hint}</p>
        <p className="text-xs text-zinc-400">
          Image {Math.min(progress + 1, target)} of {target}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => pick("cat")}
          className="rounded-md border border-violet-400/35 bg-violet-500/15 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
        >
          🐱 Cat
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => pick("dog")}
          className="rounded-md border border-amber-400/35 bg-amber-500/15 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
        >
          🐶 Dog
        </button>
      </div>
    </div>
  );
}
