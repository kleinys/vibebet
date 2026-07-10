-- =============================================================================
-- Phase 46 completion — run after partial phase 46 apply (phase 47 may already be on)
-- Fixes: missing min_hustle_tier column, flash task upsert, get_daily_hustle return type
-- Does NOT touch claim_daily_hustle_reward (phase 47 hustle-cash version stays)
-- =============================================================================

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
  drop constraint if exists daily_hustle_definitions_task_kind_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_task_kind_check
  check (task_kind in ('daily', 'spark', 'flash'));

alter table public.daily_hustle_definitions
  drop constraint if exists daily_hustle_definitions_metric_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_metric_check
  check (metric in (
    'login', 'bets', 'comments', 'court_votes', 'duel_wins',
    'platform_tag', 'platform_write', 'platform_share', 'platform_caption'
  ));

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

-- Postgres cannot change OUT-parameter row type via CREATE OR REPLACE
drop function if exists public.get_daily_hustle(text);

create or replace function public.get_daily_hustle(p_task_kind text default null)
returns table (
  task_id         text,
  title           text,
  description     text,
  target          int,
  reward_vibe     bigint,
  progress        int,
  completed       boolean,
  claimed         boolean,
  task_kind       text,
  metric          text,
  min_hustle_tier int,
  tier_locked     boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_day     date := public._today_utc();
  v_tier    int := 1;
begin
  if v_user_id is not null then
    select hustle_tier into v_tier from public.profiles where id = v_user_id;
    v_tier := coalesce(v_tier, 1);
  end if;

  return query
    select
      d.id,
      d.title,
      d.description,
      d.target,
      d.reward_vibe,
      case when d.min_hustle_tier > v_tier then 0 else coalesce(p.progress, 0) end,
      case when d.min_hustle_tier > v_tier then false else coalesce(p.completed_at is not null, false) end,
      case when d.min_hustle_tier > v_tier then false else coalesce(p.claimed_at is not null, false) end,
      d.task_kind,
      d.metric,
      d.min_hustle_tier,
      (d.min_hustle_tier > v_tier)
    from public.daily_hustle_definitions d
    left join public.user_daily_hustle_progress p
      on p.task_id = d.id
     and p.user_id = v_user_id
     and p.day = v_day
   where d.active = true
     and (p_task_kind is null or d.task_kind = p_task_kind)
   order by d.sort_order;
end;
$$;

revoke execute on function public.get_daily_hustle(text) from public;
grant execute on function public.get_daily_hustle(text) to authenticated, anon;

create or replace function public.submit_spark_hustle_progress(
  p_task_id text,
  p_amount int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task    public.daily_hustle_definitions%rowtype;
  v_tier    int := 1;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);

  select * into v_task
  from public.daily_hustle_definitions
  where id = p_task_id and active = true
    and task_kind in ('spark', 'flash');

  if not found then
    raise exception 'unknown hustle task';
  end if;

  if v_task.min_hustle_tier > v_tier then
    raise exception 'tier locked';
  end if;

  if v_task.metric not in ('platform_tag', 'platform_write', 'platform_share', 'platform_caption') then
    raise exception 'task is not manually completable';
  end if;

  perform public._tick_daily_hustle(v_user_id, v_task.metric, p_amount);

  return jsonb_build_object('ok', true, 'task_id', p_task_id);
end;
$$;

revoke execute on function public.submit_spark_hustle_progress(text, int) from public;
grant execute on function public.submit_spark_hustle_progress(text, int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('hustle_trust_enabled', false, 'HustleOS Trust Score and tier unlocks')
on conflict (key) do update set description = excluded.description;
