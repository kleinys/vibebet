import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  getGuildBySlug,
  getGuildMembers,
  getMyGuild,
} from "@/lib/guilds";
import { formatVibe } from "@/lib/utils";
import { JoinGuildForm, GuildActions } from "../guild-forms";

export const revalidate = 0;

export default async function GuildDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const enabled = await isEnabled("guilds_enabled");
  if (!enabled) notFound();

  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [guild, members, myGuild] = await Promise.all([
    getGuildBySlug(slug),
    getGuildBySlug(slug).then(async (g) =>
      g ? getGuildMembers(g.id) : [],
    ),
    user ? getMyGuild() : Promise.resolve(null),
  ]);

  if (!guild) notFound();

  const isMember = myGuild?.id === guild.id;
  const canJoin = user && !myGuild;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/guilds" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← All guilds
      </Link>

      <header className="mt-3">
        <p className="text-xs uppercase tracking-wider text-emerald-400/80">
          Guild · {guild.tag}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{guild.name}</h1>
        {guild.description && (
          <p className="mt-2 text-sm text-zinc-400">{guild.description}</p>
        )}
        <dl className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Members</dt>
            <dd className="font-medium tabular-nums">{guild.member_count}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Weekly volume</dt>
            <dd className="font-medium tabular-nums text-emerald-300">
              {formatVibe(guild.weekly_volume)} VIBE
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">All-time</dt>
            <dd className="font-medium tabular-nums">{formatVibe(guild.total_volume)}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-4 rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400">
        Share slug to invite:{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-fuchsia-300">
          {guild.slug}
        </code>
      </div>

      {isMember && myGuild && (
        <div className="mt-4">
          <GuildActions role={myGuild.role} />
        </div>
      )}

      {canJoin && (
        <div className="mt-6">
          <JoinGuildForm defaultSlug={guild.slug} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Members
        </h2>
        <ul className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-zinc-200">{m.display_name}</span>
              <span className="text-xs capitalize text-zinc-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
