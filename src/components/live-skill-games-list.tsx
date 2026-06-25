import Link from "next/link";

type LiveGame = {
  id: string;
  creator_name: string;
  opponent_name: string;
  is_friendly: boolean;
  stake: number;
  move_count: number;
  status: string;
};

export function LiveSkillGamesList({
  games,
  hrefPrefix,
  title = "Live games — watch",
}: {
  games: LiveGame[];
  hrefPrefix: string;
  title?: string;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mt-10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400">{title}</h3>
      <ul className="mt-3 space-y-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={`${hrefPrefix}/${g.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-sm hover:border-violet-400/40"
            >
              <span>
                {g.creator_name} vs {g.opponent_name}
                {g.is_friendly ? (
                  <span className="ml-2 text-[10px] text-sky-400">friendly</span>
                ) : (
                  <> · {g.stake} VIBE</>
                )}
              </span>
              <span className="text-xs text-zinc-500">
                {g.status === "matched" ? "Warm-up" : "In progress"} · {g.move_count} moves
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
