import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { NotificationBell } from "@/components/notification-bell";
import {
  getStreakInfo,
  maybeRecordDailyActivity,
} from "@/lib/streaks";
import { getCompanionInput } from "@/lib/companion-stats";
import { VibeCompanionLink } from "@/components/vibe-companion";
import { CompanionQuickPane } from "@/components/companion-quick-pane";
import { getAdrenalineTokenCount } from "@/lib/consumables-server";
import { HeaderWalletPanel } from "@/components/header-wallet-panel";
import { isEnabled } from "@/lib/feature-flags";
import { streakUrgency } from "@/lib/streak-urgency";
import { mysticEyeStreakMode } from "@/lib/companion-eyes";

export async function Header({
  mobileNavOn,
}: {
  mobileNavOn: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 初始化状态
  let balances = { vibe: 0, gem: 0 };
  let streak = 0;
  let lastActiveDate: string | null = null;
  let companionInput: Awaited<ReturnType<typeof getCompanionInput>> | null = null;

  // 初始化功能开关
  let [duelsOn, guildsOn, copyOn, limitsOn, playHubOn, interconnectOn] = [
    false, false, false, false, false, false,
  ];
  let adrenalineTokens = 0;
  let companionName: string | null = null;

  if (user) {
    try {
      await maybeRecordDailyActivity();
    } catch {
      // 不要因为记录活动失败而中断页面渲染
    }
    
    // 并行获取功能开关状态
    [duelsOn, guildsOn, copyOn, limitsOn, playHubOn, interconnectOn] = await Promise.all([
      isEnabled("duels_enabled"),
      isEnabled("guilds_enabled"),
      isEnabled("copy_trading_enabled"),
      isEnabled("limit_orders_enabled"),
      isEnabled("play_hub_enabled"),
      isEnabled("interconnect_layer_enabled"),
    ]);
    
    const [balanceResult, streakResult, companionResult, profileRow, tokenCount] =
      await Promise.allSettled([
      getAllBalances(user.id),
      getStreakInfo(user.id),
      getCompanionInput(user.id),
      interconnectOn
        ? supabase
            .from("profiles")
            .select("companion_name")
            .eq("id", user.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
      interconnectOn ? getAdrenalineTokenCount() : Promise.resolve(0),
    ]);

    // 处理余额数据
    if (balanceResult.status === 'fulfilled') {
      balances = balanceResult.value;
    }

    // 处理连击数据
    if (streakResult.status === 'fulfilled') {
      streak = streakResult.value.currentStreak;
      lastActiveDate = streakResult.value.lastActiveDate;
    }

    // 处理同伴数据
    if (companionResult.status === 'fulfilled') {
      companionInput = companionResult.value;
    }

    if (profileRow.status === "fulfilled" && profileRow.value) {
      companionName = profileRow.value.companion_name ?? null;
    }

    if (tokenCount.status === "fulfilled") {
      adrenalineTokens = tokenCount.value;
    }
  }

  const urgency = streakUrgency(streak, lastActiveDate);
  const eyeStreakMode = mysticEyeStreakMode(streak, lastActiveDate);

  const navLink =
    "shrink-0 whitespace-nowrap rounded-sm px-2 py-1 text-sm transition-colors";

  return (
    <header className="border-b border-white/5 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl"
        >
          <span className="text-fuchsia-400" aria-hidden>
            V
          </span>
          <span className={mobileNavOn ? "hidden min-[420px]:inline" : undefined}>
            Vibebet
          </span>
        </Link>

        <form
          action="/markets"
          method="GET"
          className={
            mobileNavOn
              ? "hidden min-[480px]:flex min-w-0 flex-1 max-w-lg"
              : "hidden max-w-lg flex-1 md:block"
          }
        >
          <input
            name="q"
            type="search"
            placeholder="Search markets…"
            className="w-full rounded-sm border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          {!mobileNavOn && (
            <Link
              href="/guide"
              className="hidden rounded-sm bg-fuchsia-500/15 px-3 py-2 text-xs font-medium text-fuchsia-300 ring-1 ring-fuchsia-500/30 hover:bg-fuchsia-500/25 sm:inline sm:text-sm"
            >
              Playbook
            </Link>
          )}

          {user ? (
            <>
              <HeaderWalletPanel
                streak={streak}
                vibe={balances.vibe}
                gem={balances.gem}
                streakUrgency={urgency}
              />
              <NotificationBell />
              {interconnectOn && companionInput ? (
                <CompanionQuickPane
                  input={companionInput}
                  streakUrgency={urgency}
                  adrenalineTokens={adrenalineTokens}
                  companionName={companionName}
                  eyeStreakMode={eyeStreakMode}
                />
              ) : companionInput ? (
                <VibeCompanionLink
                  input={companionInput}
                  href="/account/profile"
                  title="Your Vibe companion"
                  eyeStreakMode={eyeStreakMode}
                />
              ) : (
                <VibeCompanionLink
                  input={{
                    currentStreak: streak,
                    streakShields: 0,
                    inventoryCount: 0,
                    lastActiveDate,
                  }}
                  href="/account/profile"
                  title="Your profile"
                  eyeStreakMode={eyeStreakMode}
                />
              )}
              <Link
                href="/account"
                className="hidden max-w-[160px] truncate text-sm text-zinc-300 hover:text-white lg:inline"
              >
                {user.email}
              </Link>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="btn-responsive rounded-sm border border-white/10 text-sm text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="btn-responsive rounded-sm bg-fuchsia-500 px-3 text-sm font-medium text-white hover:bg-fuchsia-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {!mobileNavOn && (
        <nav aria-label="Main" className="border-t border-white/5 bg-zinc-950/95">
          <div className="mx-auto flex max-w-6xl items-center gap-0.5 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {interconnectOn ? (
              <>
                <Link href="/markets" className={`${navLink} text-zinc-300 hover:text-white`}>
                  Markets
                </Link>
                <Link
                  href={playHubOn ? "/play" : "/games"}
                  className={`${navLink} text-fuchsia-300/90 hover:text-fuchsia-200`}
                >
                  Play
                </Link>
                <Link href="/hustle" className={`${navLink} text-amber-300/90 hover:text-amber-200`}>
                  Hustle
                </Link>
                <Link href="/play?tab=watch" className={`${navLink} text-sky-300/90 hover:text-sky-200`}>
                  Watch
                </Link>
                <Link href="/leaderboard" className={`${navLink} text-zinc-400 hover:text-zinc-200`}>
                  Leaderboard
                </Link>
                <Link href="/shop" className={`${navLink} text-zinc-400 hover:text-zinc-200`}>
                  Shop
                </Link>
              </>
            ) : (
              <>
            {playHubOn ? (
              <Link href="/play" className={`${navLink} text-fuchsia-300/90 hover:text-fuchsia-200`}>
                Play
              </Link>
            ) : (
              <Link href="/games" className={`${navLink} text-emerald-300/90 hover:text-emerald-200`}>
                Live Arena
              </Link>
            )}
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
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}