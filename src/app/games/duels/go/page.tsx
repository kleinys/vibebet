import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { SkillGameLobby } from "@/components/skill-game-lobby";
import { LiveSkillGamesList } from "@/components/live-skill-games-list";

export const revalidate = 0;

export default async function GoPage() {
  const enabled = await isEnabled("go_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Go off</h1>
        <Link href="/games/duels" className="mt-4 inline-block text-sm text-zinc-400 hover:underline">
          ← Duel hub
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/go");

  const { data } = await supabase.rpc("get_open_go_games", { p_limit: 20 });
  const { data: liveGames } = await supabase.rpc("get_live_go_games", { p_limit: 12 }).then(
    (r) => r,
    () => ({ data: [] }),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">⚫ Go (9×9)</h1>
      <p className="mt-1 text-sm text-zinc-400">Capture stones, pass twice to score. White gets 6.5 komi.</p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <SkillGameLobby
          gameKey="go"
          title="Post Go duel"
          description="Simplified 9×9 rules — great for quick matches."
          accentClass="border-slate-500/20 bg-slate-500/5"
          buttonClass="bg-slate-600 hover:bg-slate-500"
          openGames={(data ?? []) as never[]}
          userId={user.id}
        />
      </div>
      <LiveSkillGamesList games={(liveGames ?? []) as never[]} hrefPrefix="/games/duels/go" />
    </div>
  );
}
