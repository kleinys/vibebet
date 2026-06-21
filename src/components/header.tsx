import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { BalanceBadge } from "@/components/balance-badge";
import { NotificationBell } from "@/components/notification-bell";
import {
  getStreakInfo,
  maybeRecordDailyActivity,
} from "@/lib/streaks";
import { getEquippedCosmetic } from "@/lib/cosmetics";
import { UserAvatarLink } from "@/components/user-avatar";
import { isEnabled } from "@/lib/feature-flags";

export async function Header({ mobileNavOn }: { mobileNavOn: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [liveArenaOn, fastOn, paperOn, equitiesOn, liveEventsOn] = await Promise.all([
    isEnabled("live_arena_enabled"),
    isEnabled("fast_markets_enabled"),
    isEnabled("paper_trading_duels_enabled"),
    isEnabled("equities_enabled"),
    isEnabled("live_events_enabled"),
  ]);
  const showLiveArena =
    liveArenaOn || fastOn || paperOn || equitiesOn || liveEventsOn;

  let balances = { vibe: 0, gem: 0 };
  let streak = 0;
  let equippedSlug: string | undefined;
  let duelsOn = false;
  let guildsOn = false;
  let copyOn = false;
  let limitsOn = false;

  if (user) {
    try {
      await maybeRecordDailyActivity();
    } catch {
      // Never break the shell if streak/hustle writes fail (e.g. read-only txn).
    }
    [duelsOn, guildsOn, copyOn, limitsOn] = await Promise.all([
      isEnabled("duels_enabled"),
      isEnabled("guilds_enabled"),
      isEnabled("copy_trading_enabled"),
      isEnabled("limit_orders_enabled"),
    ]);
    try {
      balances = await getAllBalances(user.id);
    } catch {
      // Ledger unreachable. Show zeros rather than crashing the shell.
    }
    try {
      const info = await getStreakInfo(user.id);
      streak = info.currentStreak;
    } catch {
      // Profile columns may not exist until migration 16.
    }
    try {
      const cosmetic = await getEquippedCosmetic(user.id);
      equippedSlug = cosmetic?.slug;
    } catch {
      // Shop tables may not exist yet.
    }
  }

  const navLink =
    "shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors";

  return (
    <header className="border-b border-white/5 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-100 sm:gap-2 sm:text-lg"
        >
          <span className="text-fuchsia-400">◆</span>
          <span className={mobileNavOn ? "hidden min-[420px]:inline" : undefined}>
            Vibebet
          </span>
        </Link>

        <form
          action="/markets"
          method="GET"
          className={
            mobileNavOn
              ? "hidden min-[480px]:flex min-w-0 flex-1 max-w-md"
              : "hidden max-w-md flex-1 md:block"
          }
        >
          <input
            name="q"
            type="search"
            placeholder="Search markets…"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {showLiveArena && (
            <Link
              href="/games"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 shadow-sm shadow-emerald-500/20 transition hover:border-emerald-300/60 hover:bg-emerald-500/25 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:text-sm"
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-full w-full rounded-full bg-emerald-400" />
              </span>
              <span className="sm:hidden">Live</span>
              <span className="hidden sm:inline">Live Arena</span>
            </Link>
          )}

          {!mobileNavOn && (
            <Link
              href="/guide"
              className="hidden rounded-md bg-fuchsia-500/15 px-2 py-1 text-xs font-medium text-fuchsia-300 ring-1 ring-fuchsia-500/30 hover:bg-fuchsia-500/25 sm:inline sm:px-2.5 sm:text-sm"
            >
              Playbook
            </Link>
          )}

          {user ? (
            <>
              {mobileNavOn && (
                <div className="flex items-center gap-1.5 sm:hidden">
                  {streak >= 1 && (
                    <span className="text-xs text-amber-200" title="Daily streak">
                      🔥{streak}
                    </span>
                  )}
                  <BalanceBadge currency="vibe" amount={balances.vibe} />
                </div>
              )}
              <div className="hidden items-center gap-2 sm:flex">
                {streak >= 1 && (
                  <Link
                    href="/account/achievements"
                    className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200"
                    title="Daily login streak"
                  >
                    🔥 {streak}
                  </Link>
                )}
                <BalanceBadge currency="vibe" amount={balances.vibe} />
                <BalanceBadge currency="gem" amount={balances.gem} />
              </div>
              <NotificationBell />
              <UserAvatarLink
                slug={equippedSlug}
                href="/account/profile"
                title="Your profile"
              />
              <Link
                href="/account"
                className="hidden max-w-[140px] truncate text-sm text-zinc-300 hover:text-white lg:inline"
              >
                {user.email}
              </Link>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-zinc-300 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {!mobileNavOn && (
        <nav
          aria-label="Main"
          className="border-t border-white/5 bg-zinc-950/95"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-0.5 overflow-x-auto px-4 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/games" className={`${navLink} text-emerald-300/90 hover:text-emerald-200`}>
              Live
            </Link>
            <Link href="/markets/fast" className={`${navLink} text-amber-300/90 hover:text-amber-200`}>
              Fast
            </Link>
            <Link href="/markets" className={`${navLink} text-zinc-300 hover:text-white`}>
              Markets
            </Link>
            <Link href="/court" className={`${navLink} text-zinc-300 hover:text-white`}>
              Polls
            </Link>
            {duelsOn && (
              <Link href="/duels" className={`${navLink} text-violet-300/90 hover:text-violet-200`}>
                Duels
              </Link>
            )}
            {guildsOn && (
              <Link href="/guilds" className={`${navLink} text-emerald-300/90 hover:text-emerald-200`}>
                Guilds
              </Link>
            )}
            {copyOn && (
              <Link href="/copy" className={`${navLink} text-cyan-300/90 hover:text-cyan-200`}>
                Copy
              </Link>
            )}
            {limitsOn && (
              <Link href="/limit-orders" className={`${navLink} text-sky-300/90 hover:text-sky-200`}>
                Limits
              </Link>
            )}
            <Link href="/shop" className={`${navLink} text-zinc-300 hover:text-white`}>
              Shop
            </Link>
            <Link href="/leaderboard" className={`${navLink} text-zinc-300 hover:text-white`}>
              Leaderboard
            </Link>
            <Link href="/tournaments" className={`${navLink} text-zinc-300 hover:text-white`}>
              Tournaments
            </Link>
            <Link href="/account/quests" className={`${navLink} text-zinc-300 hover:text-white`}>
              Quests
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
