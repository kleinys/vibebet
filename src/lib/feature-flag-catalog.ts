/** Canonical feature flags — upsert missing rows via Admin → Sync missing flags. */

export interface FeatureFlagDefinition {
  key: string;
  description: string;
}

export const FEATURE_FLAG_CATALOG: FeatureFlagDefinition[] = [
  { key: "markets_enabled", description: "Master switch for prediction markets" },
  { key: "shop_enabled", description: "Gem shop UI and purchases" },
  { key: "battle_pass_enabled", description: "Seasonal battle pass progression" },
  { key: "pro_subscription_enabled", description: "Stripe Pro subscription checkout" },
  { key: "ads_enabled", description: "Show ads on free tier" },
  { key: "real_money_enabled", description: "Real-money mode — keep OFF until licensed" },
  { key: "duels_enabled", description: "Head-to-head prediction duels with VIBE stakes" },
  { key: "guilds_enabled", description: "Guild teams with weekly volume leaderboard" },
  { key: "copy_trading_enabled", description: "Follow traders and mirror their bets" },
  { key: "limit_orders_enabled", description: "Escrowed limit buy orders on binary markets" },
  { key: "tournament_payouts_enabled", description: "Auto-pay top 3 when weekly tournament ends" },
  { key: "referrals_enabled", description: "Invite links — VIBE rewards on signup / first bet" },
  { key: "weekly_digest_enabled", description: "Weekly recap at /account/digest" },
  { key: "daily_hustle_enabled", description: "Daily earn-back tasks" },
  { key: "product_metrics_enabled", description: "Admin retention + court health dashboard" },
  { key: "analytics_dashboard_enabled", description: "Admin analytics summary + CSV export" },
  { key: "posthog_forward_enabled", description: "Mirror track_event to PostHog when configured" },
  { key: "pwa_enabled", description: "Web app manifest + Add to Home Screen" },
  { key: "push_notifications_enabled", description: "Browser push for in-app notifications" },
  { key: "mobile_nav_enabled", description: "Sticky bottom tab bar on small screens" },
  { key: "live_arena_enabled", description: "Unified /games hub — live auto-resolved betting" },
  { key: "live_feed_enabled", description: "Live trade ticker on home and market pages" },
  { key: "weekly_quests_enabled", description: "Weekly quest board with VIBE rewards" },
  { key: "tournaments_enabled", description: "Weekly volume tournament leaderboard" },
  { key: "onboarding_wizard_enabled", description: "First-run onboarding wizard" },
  { key: "player_path_picker_enabled", description: "Predict / Compete / Watch top bar + onboarding fork" },
  { key: "accuracy_leaderboard_enabled", description: "Accuracy leaderboard page" },
  { key: "creator_hub_enabled", description: "Creator dashboard and tools" },
  { key: "market_suggestions_enabled", description: "Community market suggestions flow" },
  { key: "fast_markets_enabled", description: "Fast Up/Down crypto windows" },
  { key: "recurring_series_enabled", description: "User-created recurring Up/Down series" },
  { key: "duel_spectator_markets_enabled", description: "Spectator CPMM markets on prediction duels" },
  { key: "guild_weekly_quest_enabled", description: "Guild collective weekly VIBE quest" },
  { key: "paper_trading_duels_enabled", description: "Paper trading return races (deprecated route)" },
  { key: "quick_exit_enabled", description: "Quick exit / sell positions early" },
  { key: "equities_enabled", description: "Stock Up/Down equity markets" },
  { key: "live_events_enabled", description: "Live events watch-and-bet hub" },
  { key: "arcade_games_enabled", description: "Coin Flip + Dice Duel at /games/arcade" },
  { key: "game_layer_enabled", description: "Unified duel hub at /games/duels" },
  { key: "trivia_enabled", description: "Trivia Blitz head-to-head" },
  { key: "liars_dice_enabled", description: "Liar's Dice bluff duels" },
  { key: "connect4_enabled", description: "Connect Four skill game" },
  { key: "chess_enabled", description: "Chess duels" },
  { key: "checkers_enabled", description: "Checkers duels" },
  { key: "go_enabled", description: "Go (9×9) duels" },
  { key: "shogi_enabled", description: "Shogi duels" },
  { key: "poker_enabled", description: "Heads-up hold'em showdown" },
  { key: "skill_game_spectators_enabled", description: "Spectator betting on skill games" },
  { key: "chess_clock_enabled", description: "5+3 blitz clock on chess games" },
  { key: "gems_cashout_enabled", description: "Gem withdrawal requests — legal review required" },
  { key: "gem_to_vibe_conversion_enabled", description: "Convert Gems to VIBE (one-way)" },
];

/** Never bulk-enable these from Admin — safety / legal. */
export const FEATURE_FLAGS_KEEP_OFF = new Set([
  "real_money_enabled",
  "gems_cashout_enabled",
]);

export const FEATURE_FLAG_KEYS = new Set(FEATURE_FLAG_CATALOG.map((f) => f.key));
