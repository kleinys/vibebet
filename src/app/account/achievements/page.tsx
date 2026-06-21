import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { ACHIEVEMENTS } from "@/lib/achievements";
import {
  getStreakInfo,
  getUnlockedAchievementIds,
  maybeRecordDailyActivity,
} from "@/lib/streaks";

export const revalidate = 0;

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/achievements");

  await maybeRecordDailyActivity();

  const [streak, unlocked] = await Promise.all([
    getStreakInfo(user.id),
    getUnlockedAchievementIds(user.id),
  ]);

  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Achievements</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {unlockedCount} of {ACHIEVEMENTS.length} unlocked
        </p>
      </header>

      <AccountNav active="/account/achievements" />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Current streak" value={`${streak.currentStreak} days`} />
        <StatCard label="Longest streak" value={`${streak.longestStreak} days`} />
        <StatCard
          label="Last active"
          value={
            streak.lastActiveDate
              ? new Date(streak.lastActiveDate).toLocaleDateString()
              : "—"
          }
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Badges
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const done = unlocked.has(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-xl border p-4 ${
                  done
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/5 bg-zinc-900/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{a.emoji}</span>
                  <div>
                    <div className="font-medium text-zinc-100">{a.title}</div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {a.description}
                    </p>
                    {done && (
                      <span className="mt-2 inline-block text-[10px] uppercase tracking-wider text-amber-300">
                        Unlocked
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {unlockedCount === 0 && (
          <p className="mt-4 text-sm text-zinc-500">
            Place a bet or come back tomorrow to start your streak.{" "}
            <Link href="/markets" className="text-fuchsia-400 hover:underline">
              Browse markets
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
