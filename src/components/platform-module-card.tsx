"use client";

import Link from "next/link";
import type { PlatformModule } from "@/lib/platform-modules";

const KIND_LABEL: Record<string, string> = {
  duel: "Duel",
  hustle: "Hustle",
  market: "Market",
  arcade: "Arcade",
  watch: "Watch",
};

const KIND_COLOR: Record<string, string> = {
  duel: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  hustle: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  market: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  arcade: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  watch: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};

export function PlatformModuleCard({ module }: { module: PlatformModule }) {
  return (
    <Link
      href={`/apps/${module.slug}`}
      className="group flex flex-col rounded-xl border border-white/10 bg-zinc-900/40 p-4 transition hover:border-violet-500/30 hover:bg-zinc-900/60"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl" aria-hidden>
          {module.icon_emoji}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            KIND_COLOR[module.kind] ?? KIND_COLOR.duel
          }`}
        >
          {KIND_LABEL[module.kind] ?? module.kind}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-zinc-100 group-hover:text-white">
        {module.name}
      </h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs text-zinc-500">
        {module.description}
      </p>
      <p className="mt-3 text-[10px] text-zinc-600">
        {module.install_count.toLocaleString()} installs
        {module.installed && (
          <span className="ml-2 text-emerald-400">· Installed</span>
        )}
      </p>
    </Link>
  );
}
