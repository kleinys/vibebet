-- Phase 42: Ensure weekly_digest + other catalog flags exist (safe re-run)

insert into public.feature_flags (key, enabled, description)
values
  ('referrals_enabled', false, 'Invite links — 100 VIBE on signup, 250 VIBE on friend first bet'),
  ('weekly_digest_enabled', false, 'Weekly recap at /account/digest (+ email when provider wired)'),
  ('gems_cashout_enabled', false, 'Allow Gem withdrawal requests — requires KYC, Stripe Connect, legal sign-off'),
  ('gem_to_vibe_conversion_enabled', false, 'Allow converting Gems to VIBE at 10:1 (one-way, closed loop)'),
  ('skill_game_spectators_enabled', false, 'Spawn spectator CPMM markets when skill games become active'),
  ('chess_clock_enabled', false, 'Allow optional Fischer clock (e.g. 5+3 blitz) on chess games'),
  ('quick_exit_enabled', false, 'Quick exit / sell positions early at reduced value'),
  ('equities_enabled', false, 'Stock Up/Down equity markets'),
  ('live_events_enabled', false, 'Live events watch-and-bet hub'),
  ('paper_trading_duels_enabled', false, 'Paper trading return races (deprecated — redirects to duels)')
on conflict (key) do update set description = excluded.description;
