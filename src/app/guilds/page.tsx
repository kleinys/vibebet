import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getGuildLeaderboard, getMyGuild } from "@/lib/guilds";
import { getGuildQuestStatus } from "@/lib/guild-quest";
import { formatVibe } from "@/lib/utils";
import { CreateGuildForm, GuildActions, JoinGuildForm } from "./guild-forms";
import { GuildQuestPanel } from "./guild-quest-panel";

export const revalidate = 0;

export default async function GuildsPage() {
  const enabled = await isEnabled("guilds_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Guilds off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">guilds_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/guilds");

  const [myGuild, leaderboard, quest] = await Promise.all([
    getMyGuild(),
    getGuildLeaderboard(30),
    getGuildQuestStatus(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/guide" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Playbook
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Guilds</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Team up with other predictors. Every member&apos;s bets add to your guild&apos;s
        weekly volume — climb the board together.
      </p>

      {quest && <GuildQuestPanel quest={quest} />}

      {myGuild ? (
        <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">
                Your guild
              </p>
              <h2 className="mt-1 text-lg font-semibold text-emerald-100">
                [{myGuild.tag}] {myGuild.name}
              </h2>
              {myGuild.description && (
                <p className="mt-1 text-sm text-emerald-200/70">{myGuild.description}</p>
              )}
              <p className="mt-2 text-xs text-zinc-400">
                {myGuild.member_count} members · {formatVibe(myGuild.weekly_volume)} VIBE
                this week · Role: {myGuild.role}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link
                href={`/guilds/${myGuild.slug}`}
                className="text-xs text-emerald-300 hover:underline"
              >
                Guild page →
              </Link>
              <GuildActions role={myGuild.role} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CreateGuildForm />
          <JoinGuildForm />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Weekly volume leaderboard
        </h2>
        {leaderboard.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No guilds yet. Create the first one above.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Guild</th>
                  <th className="px-4 py-2">Members</th>
                  <th className="px-4 py-2 text-right">Week</th>
                  <th className="px-4 py-2 text-right">All time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((g) => (
                  <tr
                    key={g.guild_id}
                    className={
                      myGuild?.id === g.guild_id ? "bg-emerald-500/5" : undefined
                    }
                  >
                    <td className="px-4 py-2 text-zinc-500">{g.rank}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/guilds/${g.slug}`}
                        className="font-medium text-zinc-100 hover:text-emerald-300"
                      >
                        [{g.tag}] {g.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{g.member_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatVibe(g.weekly_volume)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                      {formatVibe(g.total_volume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
