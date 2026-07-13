"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCompanionName } from "@/app/psychology/actions";

export function NameCompanionPrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setCompanionName(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-t border-fuchsia-500/20 bg-fuchsia-950/30">
      <form
        onSubmit={submit}
        className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fuchsia-200">
            Name your companion
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            They&apos;ll grow with your streak and wins — pick something yours.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nova, Byte, Lucky…"
            maxLength={24}
            className="mt-2 w-full max-w-xs rounded-md border border-white/10 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600"
            autoComplete="off"
          />
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </form>
    </div>
  );
}
