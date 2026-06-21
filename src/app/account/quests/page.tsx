import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getWeeklyQuests } from "@/lib/quests";
import { AccountNav } from "@/components/account-nav";
import { QuestBoard } from "./quest-board";

export default async function QuestsPage() {
  const enabled = await isEnabled("weekly_quests_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Quests off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">weekly_quests_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/quests");

  const quests = await getWeeklyQuests();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Weekly quests</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Resets every Monday UTC. Bet to progress — claim VIBE when done.
        </p>
      </header>

      <AccountNav active="/account/quests" />

      <QuestBoard quests={quests} />

      <p className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/tournaments" className="text-fuchsia-400 hover:underline">
          Weekly Volume Classic →
        </Link>
      </p>
    </div>
  );
}
