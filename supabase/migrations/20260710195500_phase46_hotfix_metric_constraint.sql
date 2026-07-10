-- Hotfix: run this if phase 46 failed on flash task insert (metric constraint order).
-- Safe to re-run after a successful phase 46 apply.

alter table public.profiles
  add column if not exists trust_score int not null default 500
    check (trust_score between 0 and 1000),
  add column if not exists hustle_tier int not null default 1
    check (hustle_tier between 1 and 5),
  add column if not exists spark_claims_lifetime int not null default 0
    check (spark_claims_lifetime >= 0);

alter table public.daily_hustle_definitions
  add column if not exists min_hustle_tier int not null default 1
    check (min_hustle_tier between 1 and 5);

alter table public.daily_hustle_definitions
  drop constraint if exists daily_hustle_definitions_metric_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_metric_check
  check (metric in (
    'login', 'bets', 'comments', 'court_votes', 'duel_wins',
    'platform_tag', 'platform_write', 'platform_share', 'platform_caption'
  ));

alter table public.daily_hustle_definitions
  drop constraint if exists daily_hustle_definitions_task_kind_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_task_kind_check
  check (task_kind in ('daily', 'spark', 'flash'));

insert into public.daily_hustle_definitions
  (id, title, description, metric, target, reward_vibe, sort_order, task_kind, min_hustle_tier)
values
  (
    'flash_five_bets',
    'Place 5 bets',
    'Flash tier — make five bets today on any market or live window.',
    'bets',
    5,
    150,
    201,
    'flash',
    2
  ),
  (
    'flash_win_two_duels',
    'Win 2 duels',
    'Flash tier — win two head-to-head duels in one day.',
    'duel_wins',
    2,
    200,
    202,
    'flash',
    2
  ),
  (
    'flash_caption_burst',
    'Write 3 captions',
    'Flash tier — write three short product captions (30+ chars each).',
    'platform_caption',
    3,
    125,
    203,
    'flash',
    2
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target = excluded.target,
  reward_vibe = excluded.reward_vibe,
  sort_order = excluded.sort_order,
  task_kind = excluded.task_kind,
  min_hustle_tier = excluded.min_hustle_tier,
  active = true;
