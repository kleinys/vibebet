import Link from "next/link";
import type { PlatformModule } from "@/lib/platform-modules";

export function InstalledModulesStrip({
  modules,
}: {
  modules: Pick<PlatformModule, "slug" | "name" | "target_href" | "icon_emoji">[];
}) {
  if (modules.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300/80">
        Your apps
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {modules.map((m) => (
          <li key={m.slug}>
            <Link
              href={m.target_href}
              className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-zinc-950/60 px-2.5 py-1 text-[11px] text-violet-100 hover:border-violet-400/50"
            >
              <span>{m.icon_emoji}</span>
              {m.name}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/apps" className="text-[11px] text-zinc-500 hover:text-violet-300">
            + Browse apps
          </Link>
        </li>
      </ul>
    </div>
  );
}
