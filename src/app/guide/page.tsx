import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Your playbook
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Predict the future. Stack VIBE. Climb the ranks. Zero real-money risk.
      </p>

      <article className="mt-10 space-y-10 text-sm leading-relaxed text-zinc-300">
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-lg font-semibold text-amber-100">The two wallets</h2>
          <p className="mt-2">
            <strong className="text-amber-300">VIBE</strong> is your play-money
            fuel. You start with 1,000. Win bets, keep streaks alive, finish Battle
            Pass tiers, and creator rewards all drip more VIBE. It never leaves the
            app — no cash-out, no transfers.
          </p>
          <p className="mt-2">
            <strong className="text-fuchsia-300">Gems</strong> are optional. Buy
            them for cosmetics, streak shields, and premium Battle Pass lanes. Same
            rule: in-app only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-100">
            Where the action lives
          </h2>
          <ul className="mt-3 space-y-4">
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <p className="font-medium text-zinc-100">VibeBet Picks</p>
              <p className="mt-1 text-zinc-400">
                Hand-curated headline markets — elections, crypto milestones, sports
                finals. Real VIBE pools, our automated market maker.
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <p className="font-medium text-zinc-100">Trending Clones</p>
              <p className="mt-1 text-zinc-400">
                Live odds pulled from Polymarket so you can bet VIBE on the same
                questions the world is watching. Play-money pool on Vibebet — separate
                from Polymarket&apos;s real USD volume. Odds refresh ~every 15 minutes;
                when Polymarket closes a market, we auto-settle your clone.
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <p className="font-medium text-zinc-100">Community Creations</p>
              <p className="mt-1 text-zinc-400">
                Anyone can launch a market at{" "}
                <Link href="/markets/new" className="text-fuchsia-400 hover:underline">
                  Create market
                </Link>
                . Seed it with VIBE, pick custom labels (UFC / Trump / streamer drama),
                and earn a 500 VIBE bonus if your market hits 5,000 VIBE volume.
              </p>
            </li>
            <li className="rounded-lg border border-amber-500/20 bg-zinc-900/40 p-4">
              <p className="font-medium text-amber-200">Lightning Rounds</p>
              <p className="mt-1 text-zinc-400">
                BTC / ETH / SOL Up or Down windows on{" "}
                <Link href="/markets/fast" className="text-amber-300 hover:underline">
                  Fast
                </Link>{" "}
                or the unified{" "}
                <Link href="/games" className="text-emerald-300 hover:underline">
                  Live Arena
                </Link>
                . Auto-spawn, live price chart, instant payout — no court, no waiting.
              </p>
            </li>
            <li className="rounded-lg border border-violet-500/20 bg-zinc-900/40 p-4">
              <p className="font-medium text-violet-200">Your Series</p>
              <p className="mt-1 text-zinc-400">
                Run your own recurring Up/Down lane at{" "}
                <Link
                  href="/markets/new/recurring"
                  className="text-violet-400 hover:underline"
                >
                  Recurring series
                </Link>
                . Pick asset + interval, charge a small creator fee on every bet.
                Track earnings in{" "}
                <Link href="/account/creator" className="text-violet-400 hover:underline">
                  Creator Hub
                </Link>
                .
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <p className="font-medium text-zinc-100">Pitch a Market</p>
              <p className="mt-1 text-zinc-400">
                No VIBE to seed? Post an idea at{" "}
                <Link href="/markets/suggest" className="text-fuchsia-400 hover:underline">
                  Suggest a market
                </Link>
                , rally upvotes, and get creator credit if admin launches it.
              </p>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-100">Place a bet in 30 seconds</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-300">
            <li>Pick any open Pick, Clone, or Community market.</li>
            <li>Choose your side — custom labels like &quot;Above&quot; / &quot;Below&quot; work too.</li>
            <li>Enter any whole VIBE amount (2, 47, 250 — whatever).</li>
            <li>Winning shares pay 1 VIBE each at resolution. Sell early if odds shift.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-100">
            The Courtroom — when outcomes get spicy
          </h2>
          <p className="mt-2 text-zinc-400">
            Subjective markets don&apos;t auto-resolve. After close, someone proposes
            the winner. Then the community weighs in:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-zinc-200">Challenge window (24h)</strong> — got
              a position? Stake VIBE to dispute the proposed outcome.
            </li>
            <li>
              <strong className="text-zinc-200">Community Verdict (48h)</strong> —{" "}
              <Link href="/court" className="text-fuchsia-400 hover:underline">
                vote in The Courtroom
              </Link>
              . First vote free; extra votes cost escalating VIBE if you want more
              weight.
            </li>
            <li>
              Majority wins once. Winners paid. Disputer refunded if the crowd
              overturns.
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Lightning Rounds and Trending Clones that auto-settle skip The Courtroom
            entirely.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-100">
            Climb, streak, flex
          </h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/leaderboard" className="text-fuchsia-400 hover:underline">
                Hall of Fame
              </Link>{" "}
              — profit-based tiers from Rookie → Legend.
            </li>
            <li>
              <Link href="/account/achievements" className="text-fuchsia-400 hover:underline">
                Trophy Case
              </Link>{" "}
              — badges for first wins, hot streaks, volume milestones.
            </li>
            <li>
              <Link href="/battle-pass" className="text-fuchsia-400 hover:underline">
                Season Pass
              </Link>{" "}
              — log in, trade, claim tier rewards each season.
            </li>
            <li>
              🔥 Daily streak — show up once a day; streak shows in your header.
            </li>
            <li>
              <Link href="/leaderboard/accuracy" className="text-fuchsia-400 hover:underline">
                Sharp Minds
              </Link>{" "}
              — accuracy leaderboard (Brier-scored). Profit isn&apos;t everything.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">First-run playbook</h2>
          <p className="mt-2 text-zinc-400">
            New accounts can walk through a short wizard at{" "}
            <Link href="/onboarding" className="text-fuchsia-400 hover:underline">
              /onboarding
            </Link>{" "}
            — pick interests, learn the loop, place a first bet. Enable{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">onboarding_wizard_enabled</code>{" "}
            in Admin.
          </p>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">VibeBet Pro</h2>
          <p className="mt-2 text-zinc-400">
            Optional monthly sub for power users: Pro badge, higher creation limits,
            early features. Convenience only — never a betting edge.
          </p>
        </section>

        <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <h2 className="text-lg font-semibold text-rose-100">Cancel bet (50% back)</h2>
          <p className="mt-2 text-zinc-400">
            On any open market where you hold shares, use{" "}
            <strong className="font-medium text-zinc-300">Cancel bet</strong> in the
            trade panel or in your position box. You get{" "}
            <strong className="font-medium text-zinc-300">50%</strong> of what you paid
            back — you forfeit the other half. Works on fast/crypto windows too (before
            the timer ends). Different from{" "}
            <strong className="font-medium text-zinc-300">Sell</strong> at market odds.
            Enable <code className="rounded bg-zinc-800 px-1">quick_exit_enabled</code> in
            Admin.
          </p>
        </section>

        <section className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5">
          <h2 className="text-lg font-semibold text-fuchsia-100">Watch &amp; Bet hub</h2>
          <p className="mt-2 text-zinc-400">
            Host live streams at{" "}
            <Link href="/live" className="text-fuchsia-300 hover:underline">
              /live
            </Link>{" "}
            — embed YouTube or Twitch, spawn a side market, viewers bet while they
            watch. Create everything from{" "}
            <Link href="/games/create" className="text-fuchsia-300 hover:underline">
              /games/create
            </Link>{" "}
            (streams, prediction duels, return races). Enable{" "}
            <code className="rounded bg-zinc-800 px-1">live_events_enabled</code>.
          </p>
        </section>

        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <h2 className="text-lg font-semibold text-cyan-100">Return Races</h2>
          <p className="mt-2 text-zinc-400">
            Head-to-head return races at{" "}
            <Link href="/games/paper" className="text-cyan-300 hover:underline">
              /games/paper
            </Link>
            . Each player picks BTC, ETH, or SOL to go long for 5–15 minutes. Highest %
            return wins the pool — oracle auto-settles, no court.
          </p>
        </section>

        <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <h2 className="text-lg font-semibold text-violet-100">Prediction Duels</h2>
          <p className="mt-2 text-zinc-400">
            Challenge a friend — or anyone — on an open market at{" "}
            <Link href="/duels" className="text-violet-300 hover:underline">
              /duels
            </Link>
            . Lock equal VIBE on opposite sides; when the market resolves, winner
            takes both stakes. With{" "}
            <code className="rounded bg-zinc-800 px-1">duel_spectator_markets_enabled</code>,
            accepted duels spawn a spectator market anyone can bet on.
          </p>
        </section>

        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-lg font-semibold text-emerald-100">Guilds</h2>
          <p className="mt-2 text-zinc-400">
            Team up at{" "}
            <Link href="/guilds" className="text-emerald-300 hover:underline">
              /guilds
            </Link>
            . Create or join a crew — every member&apos;s bets stack toward your
            guild&apos;s weekly volume leaderboard. Hit the collective weekly quest
            (50k VIBE) with{" "}
            <code className="rounded bg-zinc-800 px-1">guild_weekly_quest_enabled</code>{" "}
            to claim 250 VIBE per member.
          </p>
        </section>

        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Build phases — what&apos;s live</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            <li><span className="text-emerald-300">✓ Phases 0–8</span> — Ledger, markets, court, shop, discovery, PM mirrors</li>
            <li><span className="text-emerald-300">✓ Phase 9</span> — Onboarding wizard, Sharp Minds accuracy board</li>
            <li><span className="text-emerald-300">✓ Phase 10</span> — Live feed, weekly quests, volume tournaments</li>
            <li><span className="text-emerald-300">✓ Phase 11</span> — Prediction duels</li>
            <li><span className="text-emerald-300">✓ Phase 12</span> — Guilds</li>
            <li><span className="text-emerald-300">✓ Phase 13</span> — Copy trading</li>
            <li><span className="text-emerald-300">✓ Phase 14</span> — Limit orders</li>
            <li><span className="text-emerald-300">✓ Phase 15</span> — Sponsored tournament payouts (enable <code className="rounded bg-zinc-800 px-1">tournament_payouts_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 16</span> — Mobile bottom nav + search (enable <code className="rounded bg-zinc-800 px-1">mobile_nav_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 17</span> — Analytics dashboard + PostHog export (enable <code className="rounded bg-zinc-800 px-1">analytics_dashboard_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 18</span> — PWA install + browser push</li>
            <li><span className="text-emerald-300">✓ Phase 19</span> — Referrals + weekly digest</li>
            <li><span className="text-emerald-300">✓ Phase 20</span> — Daily Hustle earn-back + admin metrics (enable <code className="rounded bg-zinc-800 px-1">daily_hustle_enabled</code>, <code className="rounded bg-zinc-800 px-1">product_metrics_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 21</span> — Duel spectator markets, guild weekly quest, creator dashboard v2</li>
            <li><span className="text-emerald-300">✓ Phase 22</span> — Live Arena hub at <code className="rounded bg-zinc-800 px-1">/games</code></li>
            <li><span className="text-emerald-300">✓ Phase 23</span> — Return Races (enable <code className="rounded bg-zinc-800 px-1">paper_trading_duels_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 24–25</span> — Cancel bet 50% back (enable <code className="rounded bg-zinc-800 px-1">quick_exit_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 26</span> — Equities Up/Down (enable <code className="rounded bg-zinc-800 px-1">equities_enabled</code>)</li>
            <li><span className="text-emerald-300">✓ Phase 27</span> — Watch &amp; Bet live hub (enable <code className="rounded bg-zinc-800 px-1">live_events_enabled</code>)</li>
            <li><span className="text-zinc-500">○ Next</span> — Equities Up/Down oracle</li>
          </ul>
        </section>

        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <h2 className="text-lg font-semibold text-cyan-100">Copy Trading</h2>
          <p className="mt-2 text-zinc-400">
            Follow sharp predictors at{" "}
            <Link href="/copy" className="text-cyan-300 hover:underline">
              /copy
            </Link>
            . Mirror their bets manually or turn on auto-copy up to your max stake.
          </p>
        </section>

        <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
          <h2 className="text-lg font-semibold text-sky-100">Limit Orders</h2>
          <p className="mt-2 text-zinc-400">
            Set a target price on any open market — VIBE is escrowed until odds hit
            your limit or you cancel. Manage orders at{" "}
            <Link href="/limit-orders" className="text-sky-300 hover:underline">
              /limit-orders
            </Link>
            .
          </p>
        </section>

        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-lg font-semibold text-amber-100">Sponsored Prizes</h2>
          <p className="mt-2 text-zinc-400">
            Weekly Volume Classic pays top 3 automatically when the week ends
            (50% / 30% / 20%). Admins can boost the pool at Admin → Tournament
            sponsor. See live standings at{" "}
            <Link href="/tournaments" className="text-amber-300 hover:underline">
              /tournaments
            </Link>
            .
          </p>
        </section>

        <section className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
          <h2 className="text-lg font-semibold text-teal-100">Mobile app feel</h2>
          <p className="mt-2 text-zinc-400">
            On phones, enable the sticky bottom tab bar (Markets · Fast · Court ·
            Rank · More) via{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">mobile_nav_enabled</code>{" "}
            in Admin. Search stays in the header; secondary links live under More.
          </p>
        </section>

        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <h2 className="text-lg font-semibold text-cyan-100">Analytics</h2>
          <p className="mt-2 text-zinc-400">
            Key events (signup, first bet, onboarding) land in{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">analytics_events</code>.
            Admins can review counts and export CSV at Admin when{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">analytics_dashboard_enabled</code>{" "}
            is on. Optional PostHog mirror via{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">NEXT_PUBLIC_POSTHOG_KEY</code> +{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">posthog_forward_enabled</code>.
          </p>
        </section>

        <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <h2 className="text-lg font-semibold text-violet-100">Install &amp; push</h2>
          <p className="mt-2 text-zinc-400">
            Add Vibebet to your home screen when{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">pwa_enabled</code>{" "}
            is on. Enable browser push at{" "}
            <Link href="/account/notifications" className="text-violet-300 hover:underline">
              Account → Notifications
            </Link>{" "}
            when <code className="rounded bg-zinc-800 px-1 text-xs">push_notifications_enabled</code>{" "}
            is on (requires VAPID keys in server env).
          </p>
        </section>

        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-lg font-semibold text-emerald-100">Invite friends</h2>
          <p className="mt-2 text-zinc-400">
            Share your link at{" "}
            <Link href="/invite" className="text-emerald-300 hover:underline">
              /invite
            </Link>
            . Earn 100 VIBE when a friend signs up + 250 VIBE when they place
            their first bet. Weekly recap at{" "}
            <Link href="/account/digest" className="text-emerald-300 hover:underline">
              /account/digest
            </Link>
            .
          </p>
        </section>

        <section className="text-xs text-zinc-500">
          <p>Still building: automated email digests (Resend) and native app wrapper.</p>
        </section>
      </article>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/markets"
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
        >
          Browse markets
        </Link>
        <Link
          href="/markets/fast"
          className="rounded-md border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
        >
          Lightning Rounds
        </Link>
        <Link
          href="/onboarding"
          className="rounded-md border border-violet-500/40 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10"
        >
          Setup wizard
        </Link>
        <Link
          href="/duels"
          className="rounded-md border border-violet-500/40 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10"
        >
          Duels
        </Link>
        <Link
          href="/guilds"
          className="rounded-md border border-emerald-500/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
        >
          Guilds
        </Link>
        <Link
          href="/limit-orders"
          className="rounded-md border border-sky-500/40 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/10"
        >
          Limit orders
        </Link>
      </div>
    </div>
  );
}
