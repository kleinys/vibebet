-- =============================================================================
-- Phase 20: Daily Hustle (earn-back loop) + Admin product metrics
-- =============================================================================

-- Daily earn tasks — lightweight HustleOS-style loop (not full skill trees).
create table if not exists public.daily_hustle_definitions (
  id            text primary key,
  title         text not null,
  description   text not null,
  metric        text not null check (metric in ('login', 'bets', 'comments', 'court_votes')),
  target        int not null check (target > 0),
  reward_vibe   bigint not null check (reward_vibe > 0),
  sort_order    int not null default 0,
  active        boolean not null default true
);

create table if not exists public.user_daily_hustle_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       text not null references public.daily_hustle_definitions(id) on delete cascade,
  day           date not null,
  progress      int not null default 0 check (progress >= 0),
  completed_at  timestamptz,
  claimed_at    timestamptz,
  primary key (user_id, task_id, day)
);

alter table public.daily_hustle_definitions enable row level security;
alter table public.user_daily_hustle_progress enable row level security;

drop policy if exists daily_hustle_definitions_select on public.daily_hustle_definitions;
create policy daily_hustle_definitions_select on public.daily_hustle_definitions
  for select to authenticated, anon using (active = true);

drop policy if exists user_daily_hustle_select_own on public.user_daily_hustle_progress;
create policy user_daily_hustle_select_own on public.user_daily_hustle_progress
  for select to authenticated using (user_id = auth.uid());

insert into public.daily_hustle_definitions (id, title, description, metric, target, reward_vibe, sort_order) values
  ('daily_login', 'Show up', 'Log in today.', 'login', 1, 10, 1),
  ('daily_bet', 'Place a bet', 'Make at least one bet today.', 'bets', 1, 25, 2),
  ('daily_comment', 'Join the chat', 'Comment on any market today.', 'comments', 1, 15, 3),
  ('daily_vote', 'Court duty', 'Cast a vote in The Courtroom today.', 'court_votes', 1, 20, 4)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target = excluded.target,
  reward_vibe = excluded.reward_vibe,
  sort_order = excluded.sort_order;

create or replace function public._today_utc()
returns date
language sql
immutable
as $$ select (now() at time zone 'utc')::date; $$;

create or replace function public._tick_daily_hustle(
  p_user_id uuid,
  p_metric text,
  p_amount int default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task record;
  v_day date := public._today_utc();
  v_prog int;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return;
  end if;

  for v_task in
    select d.id, d.target
    from public.daily_hustle_definitions d
    where d.active and d.metric = p_metric
  loop
    insert into public.user_daily_hustle_progress (user_id, task_id, day, progress)
    values (p_user_id, v_task.id, v_day, least(p_amount, v_task.target))
    on conflict (user_id, task_id, day) do update
      set progress = least(
        public.user_daily_hustle_progress.progress + excluded.progress,
        v_task.target
      );

    select progress into v_prog
    from public.user_daily_hustle_progress
    where user_id = p_user_id and task_id = v_task.id and day = v_day;

    if v_prog >= v_task.target then
      update public.user_daily_hustle_progress
      set completed_at = coalesce(completed_at, now())
      where user_id = p_user_id and task_id = v_task.id and day = v_day;
    end if;
  end loop;
end;
$$;

revoke execute on function public._tick_daily_hustle(uuid, text, int) from public;

-- Extend daily login streak hook with hustle progress.
create or replace function public.record_daily_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date := public._today_utc();
  v_profile   public.profiles%rowtype;
  v_streak    int;
begin
  if v_user_id is null then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then return jsonb_build_object('skipped', true); end if;

  if v_profile.last_active_date = v_today then
    return jsonb_build_object(
      'current_streak', v_profile.current_streak,
      'already_recorded', true
    );
  end if;

  if v_profile.last_active_date = v_today - 1 then
    v_streak := v_profile.current_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
     set current_streak   = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_active_date = v_today,
         updated_at       = now()
   where id = v_user_id;

  begin
    perform public.check_achievements(v_user_id);
  exception when others then null;
  end;

  begin
    perform public.grant_battle_pass_xp(15);
  exception when others then null;
  end;

  begin
    perform public._tick_daily_hustle(v_user_id, 'login', 1);
  exception when others then null;
  end;

  return jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', greatest(v_profile.longest_streak, v_streak),
    'already_recorded', false
  );
end;
$$;

create or replace function public.get_daily_hustle()
returns table (
  task_id       text,
  title         text,
  description   text,
  target        int,
  reward_vibe   bigint,
  progress      int,
  completed     boolean,
  claimed       boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_day     date := public._today_utc();
begin
  return query
    select
      d.id,
      d.title,
      d.description,
      d.target,
      d.reward_vibe,
      coalesce(p.progress, 0),
      coalesce(p.completed_at is not null, false),
      coalesce(p.claimed_at is not null, false)
    from public.daily_hustle_definitions d
    left join public.user_daily_hustle_progress p
      on p.task_id = d.id
     and p.user_id = v_user_id
     and p.day = v_day
   where d.active = true
   order by d.sort_order;
end;
$$;

revoke execute on function public.get_daily_hustle() from public;
grant  execute on function public.get_daily_hustle() to authenticated, anon;

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
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_task from public.daily_hustle_definitions
   where id = p_task_id and active = true;
  if not found then raise exception 'unknown task'; end if;

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
    jsonb_build_object('task_id', p_task_id, 'amount', v_task.reward_vibe),
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

  perform public.track_event('daily_hustle_claimed', jsonb_build_object(
    'task_id', p_task_id,
    'reward', v_task.reward_vibe
  ));

  return v_task.reward_vibe;
end;
$$;

revoke execute on function public.claim_daily_hustle_reward(text) from public;
grant  execute on function public.claim_daily_hustle_reward(text) to authenticated;

-- Tick hustle metrics from trade / comment / vote paths.
create or replace function public._after_trade_hustle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._tick_daily_hustle(new.user_id, 'bets', 1);
  return new;
end;
$$;

drop trigger if exists trades_daily_hustle on public.trades;
create trigger trades_daily_hustle
  after insert on public.trades
  for each row execute function public._after_trade_hustle();

create or replace function public._after_comment_hustle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._tick_daily_hustle(new.user_id, 'comments', 1);
  return new;
end;
$$;

drop trigger if exists comments_daily_hustle on public.market_comments;
create trigger comments_daily_hustle
  after insert on public.market_comments
  for each row execute function public._after_comment_hustle();

create or replace function public._after_court_vote_hustle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._tick_daily_hustle(new.user_id, 'court_votes', 1);
  return new;
end;
$$;

drop trigger if exists court_votes_daily_hustle on public.court_votes;
create trigger court_votes_daily_hustle
  after insert on public.court_votes
  for each row execute function public._after_court_vote_hustle();

-- Admin product metrics (retention + court health).
create or replace function public.get_product_metrics(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(1, least(p_days, 90));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_signups int;
  v_first_bets int;
  v_d1 int;
  v_d7 int;
  v_disputes int;
  v_votes int;
  v_active_users int;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select count(*)::int into v_signups
  from public.profiles p
  where p.created_at >= v_since;

  select count(*)::int into v_first_bets
  from public.onboarding_progress o
  where o.first_bet_at is not null
    and o.first_bet_at >= v_since;

  select count(distinct p.id)::int into v_d1
  from public.profiles p
  where p.created_at >= v_since
    and exists (
      select 1 from public.trades t
      where t.user_id = p.id
        and t.created_at::date = (p.created_at + interval '1 day')::date
    );

  select count(distinct p.id)::int into v_d7
  from public.profiles p
  where p.created_at >= v_since - interval '7 days'
    and p.created_at <= now() - interval '7 days'
    and exists (
      select 1 from public.trades t
      where t.user_id = p.id
        and t.created_at >= p.created_at + interval '7 days'
        and t.created_at <= p.created_at + interval '8 days'
    );

  select count(*)::int into v_disputes
  from public.disputes d
  where d.created_at >= v_since;

  select count(*)::int into v_votes
  from public.court_votes cv
  where cv.created_at >= v_since;

  select count(distinct user_id)::int into v_active_users
  from public.trades t
  where t.created_at >= v_since;

  return jsonb_build_object(
    'period_days', v_days,
    'signups', v_signups,
    'first_bets', v_first_bets,
    'first_bet_rate_pct', case when v_signups > 0 then round(100.0 * v_first_bets / v_signups, 1) else 0 end,
    'd1_retention_pct', case when v_signups > 0 then round(100.0 * v_d1 / v_signups, 1) else 0 end,
    'd7_retention_pct', case when v_signups > 0 then round(100.0 * v_d7 / greatest(v_signups, 1), 1) else 0 end,
    'disputes_opened', v_disputes,
    'court_votes', v_votes,
    'votes_per_dispute', case when v_disputes > 0 then round(v_votes::numeric / v_disputes, 1) else 0 end,
    'active_traders', v_active_users,
    'referrals_enabled', (select enabled from public.feature_flags where key = 'referrals_enabled'),
    'daily_hustle_enabled', (select enabled from public.feature_flags where key = 'daily_hustle_enabled')
  );
end;
$$;

revoke execute on function public.get_product_metrics(int) from public;
grant  execute on function public.get_product_metrics(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('daily_hustle_enabled', false, 'Daily earn-back tasks (login, bet, comment, court vote)'),
  ('product_metrics_enabled', false, 'Admin retention + court health dashboard')
on conflict (key) do update set description = excluded.description;
