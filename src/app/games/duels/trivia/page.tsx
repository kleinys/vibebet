import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { TriviaDuelPanel } from "../trivia-panels";

export const revalidate = 0;

async function getOpenTriviaDuels() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_open_trivia_duels", { p_limit: 20 });
  return (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
  }[];
}

export default async function TriviaDuelsPage() {
  const enabled = await isEnabled("trivia_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Trivia off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">trivia_enabled</code> in Admin.
        </p>
        <Link href="/games/duels" className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline">
          ← Duel hub
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/trivia");

  const openDuels = await getOpenTriviaDuels();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">🧠 Trivia Blitz</h1>
      <p className="mt-1 text-sm text-zinc-400">
        5 questions head-to-head. Most correct wins.
      </p>
      <TriviaDuelPanel openDuels={openDuels} userId={user.id} />
    </div>
  );
}
