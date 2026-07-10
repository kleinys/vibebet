-- =============================================================================
-- Phase 46: HustleOS Phase B — Trust Score, tier unlocks, Flash tasks
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

-- ---------------------------------------------------------------------------
-- Trust score + tier resolution (lite formula for MVP)
-- ---------------------------------------------------------------------------
create or replace function public._hustle_streak_bonus(p_streak int)
returns int
language sql
immutable
as $$
  select case
    when p_streak >= 90 then 600
    when p_streak >= 60 then 350
    when p_streak >= 30 then 150
    when p_streak >= 14 then 60
    when p_streak >= 7 then 25
    else 0
  end;
$$;

create or replace function public._hustle_platform_fee_pct(p_trust int)
returns int
language sql
immutable
as $$
  select case
    when p_trust >= 900 then 5
    when p_trust >= 800 then 6
    when p_trust >= 700 then 8
    when p_trust >= 600 then 10
    when p_trust >= 500 then 12
    else 15
  end;
$$;

create or replace function public._resolve_hustle_tier(
  p_user_id uuid,
  p_trust_score int,
  p_spark_claims int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier int := 1;
begin
  if p_trust_score >= 850 or p_spark_claims >= 80 then
    v_tier := 5;
  elsif p_trust_score >= 750 or p_spark_claims >= 50 then
    v_tier := 4;
  elsif p_trust_score >= 650 or p_spark_claims >= 35 then
    v_tier := 3;
  elsif p_trust_score >= 550 or p_spark_claims >= 20 then
    v_tier := 2;
  end if;
  return v_tier;
end;
$$;

create or replace function public._refresh_hustle_trust(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_achievements int := 0;
  v_duel_wins int := 0;
  v_hustle_claims int := 0;
  v_score int;
  v_tier int;
begin
  if p_user_id is null then return; end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return; end if;

  select count(*)::int into v_achievements
  from public.user_achievements where user_id = p_user_id;

  select count(*)::int into v_duel_wins
  from public.duels where winner_id = p_user_id and status = 'settled';

  select count(*)::int into v_hustle_claims
  from public.user_daily_hustle_progress
  where user_id = p_user_id and claimed_at is not null;

  v_score := 500
    + (v_profile.spark_claims_lifetime * 5)
    + (v_hustle_claims * 3)
    + (v_profile.current_streak * 2)
    + public._hustle_streak_bonus(v_profile.current_streak)
    + (v_achievements * 10)
    + (v_duel_wins * 15);

  v_score := greatest(0, least(1000, v_score));
  v_tier := public._resolve_hustle_tier(p_user_id, v_score, v_profile.spark_claims_lifetime);

  update public.profiles
  set trust_score = v_score,
      hustle_tier = v_tier,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public._refresh_hustle_trust(uuid) from public;

-- ---------------------------------------------------------------------------
-- Hustle tasks RPC (trust + tier metadata)
-- ---------------------------------------------------------------------------
create or replace function public.get_hustle_oracle()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_next_tier int;
  v_next_label text;
  v_progress int;
  v_target int;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  perform public._refresh_hustle_trust(v_user_id);

  select * into v_profile from public.profiles where id = v_user_id;

  v_next_tier := least(5, v_profile.hustle_tier + 1);

  v_target := case v_next_tier
    when 2 then 20
    when 3 then 35
    when 4 then 50
    when 5 then 80
    else 20
  end;

  v_progress := v_profile.spark_claims_lifetime;

  v_next_label := case v_next_tier
    when 2 then 'Flash'
    when 3 then 'Gig'
    when 4 then 'Pro'
    when 5 then 'Elite'
    else null
  end;

  return jsonb_build_object(
    'authenticated', true,
    'trust_score', v_profile.trust_score,
    'hustle_tier', v_profile.hustle_tier,
    'tier_label', case v_profile.hustle_tier
      when 1 then 'Spark'
      when 2 then 'Flash'
      when 3 then 'Gig'
      when 4 then 'Pro'
      when 5 then 'Elite'
      else 'Spark'
    end,
    'spark_claims_lifetime', v_profile.spark_claims_lifetime,
    'platform_fee_pct', public._hustle_platform_fee_pct(v_profile.trust_score),
    'current_streak', v_profile.current_streak,
    'next_tier', case when v_profile.hustle_tier >= 5 then null else v_next_tier end,
    'next_tier_label', case when v_profile.hustle_tier >= 5 then null else v_next_label end,
    'next_tier_spark_target', case when v_profile.hustle_tier >= 5 then null else v_target end,
    'next_tier_spark_progress', case when v_profile.hustle_tier >= 5 then null else least(v_progress, v_target) end,
    'next_tier_trust_gate', case v_next_tier
      when 2 then 550
      when 3 then 650
      when 4 then 750
      when 5 then 850
      else null
    end
  );
end;
$$;

revoke execute on function public.get_hustle_oracle() from public;
grant execute on function public.get_hustle_oracle() to authenticated;

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

create or replace function public.claim_daily_hustle_reward(p_task_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_day       date := public._today_utc();
  v_task      public.daily_hustle_definitions%rowtype;
  v_progress  public.user_daily_hustle_progress%rowtype;
  v_wallet    uuid;
  v_mint      uuid;
  v_tx_id     uuid;
  v_tier      int := 1;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);

  select * into v_task from public.daily_hustle_definitions
   where id = p_task_id and active = true;
  if not found then raise exception 'unknown task'; end if;

  if v_task.min_hustle_tier > v_tier then
    raise exception 'tier locked — unlock % first', v_task.min_hustle_tier;
  end if;

  select * into v_progress from public.user_daily_hustle_progress
   where user_id = v_user_id and task_id = p_task_id and day = v_day;
  if not found or v_progress.completed_at is null then
    raise exception 'task not completed';
  end if;
  if v_progress.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'daily_hustle_reward',
    'daily_hustle:' || p_task_id || ':' || v_user_id::text || ':' || v_day::text,
    jsonb_build_object('task_id', p_task_id, 'amount', v_task.reward_vibe, 'task_kind', v_task.task_kind),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency)
  values
    (v_tx_id, v_wallet, v_task.reward_vibe, 'vibe'),
    (v_tx_id, v_mint, -v_task.reward_vibe, 'vibe');

  update public.user_daily_hustle_progress
  set claimed_at = now()
  where user_id = v_user_id and task_id = p_task_id and day = v_day;

  if v_task.task_kind = 'spark' then
    update public.profiles
    set spark_claims_lifetime = spark_claims_lifetime + 1
    where id = v_user_id;
  end if;

  perform public._refresh_hustle_trust(v_user_id);

  perform public.track_event('daily_hustle_claimed', jsonb_build_object(
    'task_id', p_task_id,
    'reward', v_task.reward_vibe,
    'task_kind', v_task.task_kind
  ));

  return v_task.reward_vibe;
end;
$$;

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

insert into public.feature_flags (key, enabled, description)
values ('hustle_trust_enabled', false, 'HustleOS Trust Score and tier unlocks')
on conflict (key) do update set description = excluded.description;
