import Link from "next/link";

const LINKS = [
  {
    href: "/account/profile#trainer",
    label: "Trainer & skins",
    hint: "Equip outfits, see your spirit animal",
  },
  {
    href: "/account/profile#locker-rewards",
    label: "VIBE case",
    hint: "Stake VIBE · weighted payout",
  },
  {
    href: "/account/profile#locker-rewards",
    label: "Daily wheel",
    hint: "1 free spin · up to 2,500 VIBE",
  },
  {
    href: "/shop",
    label: "Shop",
    hint: "More trainer themes & badges",
  },
] as const;

export function CompanionDiscoverBar({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            title={link.hint}
            className="rounded-sm border border-violet-500/25 bg-violet-950/40 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:border-fuchsia-400/40 hover:bg-violet-900/50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-sm border border-violet-500/20 bg-gradient-to-r from-violet-950/50 via-zinc-950 to-fuchsia-950/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            Trainer & locker
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-400">
            Your companion lives on Profile — equip a skin to change trainer + spirit animal,
            then try the VIBE case or daily wheel below the locker stage.
          </p>
        </div>
        <Link
          href="/account/profile"
          className="shrink-0 rounded-sm bg-fuchsia-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-fuchsia-500"
        >
          Open profile
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="block rounded-sm border border-white/10 bg-zinc-950/60 px-3 py-2 transition hover:border-violet-400/35 hover:bg-violet-950/40"
            >
              <span className="text-xs font-semibold text-zinc-200">{link.label}</span>
              <span className="mt-0.5 block text-[10px] text-zinc-500">{link.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
