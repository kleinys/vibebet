-- =============================================================================
-- Phase 48 hotfix — slots constraint + seed ONLY
-- =============================================================================
-- PREREQUISITE: hustle_gigs table must exist.
-- If you see "relation hustle_gigs does not exist", run the FULL script first:
--   supabase/migrations/20260710220000_phase48_hustleos_marketplace.sql
-- Then re-run this file only if the seed step failed on slots_check.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'hustle_gigs'
  ) then
    raise exception
      'Table public.hustle_gigs does not exist. Run 20260710220000_phase48_hustleos_marketplace.sql in full first (creates tables + RPCs), then run this hotfix only if seed failed.';
  end if;
end $$;

alter table public.hustle_gigs
  drop constraint if exists hustle_gigs_slots_check;

alter table public.hustle_gigs
  add constraint hustle_gigs_slots_check
  check (slots between 1 and 50);

insert into public.hustle_gigs (
  id, poster_id, title, description, category, reward_vibe,
  min_hustle_tier, slots, is_platform, proof_instructions, expires_at
)
values
  (
    'a1000001-0001-4000-8000-000000000001',
    null,
    'Tag 10 product images',
    'Open the Spark tag tool and label ten images with accurate product tags. Paste your session summary in proof.',
    'moderation',
    200,
    2,
    20,
    true,
    'Include how many images you tagged and one example tag set.',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000002',
    null,
    'Write a 200-word market brief',
    'Pick any open market and write a neutral 200+ word summary: context, key arguments, and your read (no financial advice).',
    'content',
    350,
    3,
    15,
    true,
    'Paste the market URL and your full write-up (200+ words).',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000003',
    null,
    'Share VibeBet on X with proof',
    'Post a genuine take about prediction markets or a market you follow. Link must stay up 24h.',
    'creative',
    275,
    2,
    25,
    true,
    'Paste the tweet URL and a one-line summary of your angle.',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000004',
    null,
    'Research 5 competitor features',
    'Compare five features across Polymarket, Kalshi, or similar vs VibeBet. Table format in proof.',
    'research',
    400,
    3,
    10,
    true,
    'Paste a feature comparison table with sources.',
    now() + interval '30 days'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  reward_vibe = excluded.reward_vibe,
  slots = excluded.slots,
  min_hustle_tier = excluded.min_hustle_tier,
  proof_instructions = excluded.proof_instructions,
  expires_at = excluded.expires_at,
  status = case when hustle_gigs.status = 'completed' then hustle_gigs.status else 'open' end,
  is_platform = true;

insert into public.feature_flags (key, enabled, description)
values ('hustle_marketplace_enabled', false, 'HustleOS Gig marketplace — post and claim escrowed tasks')
on conflict (key) do update set description = excluded.description;
