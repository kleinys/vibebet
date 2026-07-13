import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getDailyHustle } from "@/lib/daily-hustle";
import { AccountNav } from "@/components/account-nav";
import { DailyHustleBoard } from "@/components/daily-hustle-board";

export default async function HustlePage() {
  const [enabled, playHubOn, interconnectOn] = await Promise.all([
    isEnabled("daily_hustle_enabled"),
    isEnabled("play_hub_enabled"),
    isEnabled("interconnect_layer_enabled"),
  ]);

  if (interconnectOn) {
    redirect("/hustle");
  }
  if (playHubOn) {
    redirect("/play?tab=hustle");
  }
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Daily Hustle off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">daily_hustle_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/hustle");

  const tasks = await getDailyHustle();
  const totalAvailable = tasks
    .filter((t) => t.completed && !t.claimed)
    .reduce((n, t) => n + t.reward_vibe, 0);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Daily Hustle</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Earn VIBE back every day — login, bet, comment, or vote. Resets at
          midnight UTC.
        </p>
        {totalAvailable > 0 && (
          <p className="mt-2 text-sm text-amber-200">
            {totalAvailable} VIBE ready to claim ↓
          </p>
        )}
      </header>

      <AccountNav active="/account/hustle" />

      <DailyHustleBoard tasks={tasks} />

      <p className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/account/quests" className="text-fuchsia-400 hover:underline">
          Weekly quests →
        </Link>
        {" · "}
        <Link href="/invite" className="text-fuchsia-400 hover:underline">
          Invite friends →
        </Link>
      </p>
    </div>
  );
}
