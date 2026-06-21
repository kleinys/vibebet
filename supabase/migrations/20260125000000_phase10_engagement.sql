-- =============================================================================
-- Phase 10: Live feed, weekly quests, tournaments, quest/tournament hooks
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Live activity feed (populated on every trade)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_feed (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'trade',
  user_id          uuid references auth.users(id) on delete set null,
  market_id        uuid references public.markets(id) on delete set null,
  display_name     text,
  market_question  text,
  amount           bigint not null default 0,
  side             text,
  created_at       timestamptz not null default now()
);

create index if not exists activity_feed_time_idx
  on public.activity_feed (created_at desc);

alter table public.activity_feed enable row level security;

drop policy if exists activity_feed_select on public.activity_feed;
create policy activity_feed_select on public.activity_feed
  for select to authenticated, anon using (true);

-- ---------------------------------------------------------------------------
-- Weekly quests
-- ---------------------------------------------------------------------------
create table if not exists public.quest_definitions (
  id            text primary key,
  title         text not null,
  description   text not null,
  metric        text not null check (metric in ('bets_placed', 'vibe_wagered')),
  target        int not null check (target > 0),
  reward_vibe   bigint not null check (reward_vibe > 0),
  sort_order    int not null default 0,
  active        boolean not null default true
);

create table if not exists public.user_quest_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  quest_id      text not null references public.quest_definitions(id) on delete cascade,
  period_start  date not null,
  progress      int not null default 0 check (progress >= 0),
  completed_at  timestamptz,
  claimed_at    timestamptz,
  primary key (user_id, quest_id, period_start)
);

alter table public.quest_definitions enable row level security;
alter table public.user_quest_progress enable row level security;

drop policy if exists quest_definitions_select on public.quest_definitions;
create policy quest_definitions_select on public.quest_definitions
  for select to authenticated, anon using (active = true);

drop policy if exists user_quest_progress_select_own on public.user_quest_progress;
create policy user_quest_progress_select_own on public.user_quest_progress
  for select to authenticated using (user_id = auth.uid());

insert into public.quest_definitions (id, title, description, metric, target, reward_vibe, sort_order) values
  ('weekly_3_bets', 'Hot hand', 'Place 3 bets this week.', 'bets_placed', 3, 75, 1),
  ('weekly_10_bets', 'In the arena', 'Place 10 bets this week.', 'bets_placed', 10, 200, 2),
  ('weekly_500_wager', 'High roller', 'Wager 500 VIBE this week.', 'vibe_wagered', 500, 150, 3),
  ('weekly_2000_wager', 'Whale week', 'Wager 2,000 VIBE this week.', 'vibe_wagered', 2000, 500, 4)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target = excluded.target,
  reward_vibe = excluded.reward_vibe,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Weekly tournaments (volume-based scoring)
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  prize_pool   bigint not null default 2000 check (prize_pool >= 0),
  status       text not null default 'active'
    check (status in ('upcoming', 'active', 'closed')),
  created_at   timestamptz not null default now()
);

create table if not exists public.tournament_scores (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  volume        bigint not null default 0 check (volume >= 0),
  updated_at    timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create index if not exists tournament_scores_rank_idx
  on public.tournament_scores (tournament_id, volume desc);

alter table public.tournaments enable row level security;
alter table public.tournament_scores enable row level security;

drop policy if exists tournaments_select on public.tournaments;
create policy tournaments_select on public.tournaments
  for select to authenticated, anon using (true);

drop policy if exists tournament_scores_select on public.tournament_scores;
create policy tournament_scores_select on public.tournament_scores
  for select to authenticated, anon using (true);

-- Seed / refresh the current weekly volume tournament.
insert into public.tournaments (slug, title, description, starts_at, ends_at, prize_pool, status)
values (
  'weekly_volume_' || to_char(date_trunc('week', now())::date, 'IYYY_IW'),
  'Weekly Volume Classic',
  'Most VIBE wagered this week tops the board. Play-money bragging rights + prize pool.',
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  2000,
  'active'
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  ends_at = excluded.ends_at,
  prize_pool = excluded.prize_pool,
  status = case when excluded.ends_at > now() then 'active' else 'closed' end;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._week_start(p_ts timestamptz default now())
returns date
language sql
immutable
as $$
  select date_trunc('week', p_ts)::date;
$$;

create or replace function public._bump_quest_progress(
  p_user_id uuid,
  p_metric  text,
  p_delta   int
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := public._week_start(now());
  v_quest record;
  v_row  public.user_quest_progress%rowtype;
begin
  if p_user_id is null or p_delta <= 0 then return; end if;

  for v_quest in
    select * from public.quest_definitions
     where active = true and metric = p_metric
  loop
    insert into public.user_quest_progress (user_id, quest_id, period_start, progress)
    values (p_user_id, v_quest.id, v_week, p_delta)
    on conflict (user_id, quest_id, period_start) do update
      set progress = public.user_quest_progress.progress + p_delta;

    select * into v_row
      from public.user_quest_progress
     where user_id = p_user_id
       and quest_id = v_quest.id
       and period_start = v_week;

    if v_row.progress >= v_quest.target and v_row.completed_at is null then
      update public.user_quest_progress
         set completed_at = now()
       where user_id = p_user_id
         and quest_id = v_quest.id
         and period_start = v_week;
    end if;
  end loop;
end;
$$;

revoke execute on function public._bump_quest_progress(uuid, text, int) from public;

create or replace function public._bump_tournament_volume(
  p_user_id uuid,
  p_amount  bigint
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  if p_user_id is null or p_amount <= 0 then return; end if;

  select id into v_tournament_id
    from public.tournaments
   where status = 'active'
     and starts_at <= now()
     and ends_at > now()
   order by starts_at desc
   limit 1;

  if v_tournament_id is null then return; end if;

  insert into public.tournament_scores (tournament_id, user_id, volume)
  values (v_tournament_id, p_user_id, p_amount)
  on conflict (tournament_id, user_id) do update
    set volume = public.tournament_scores.volume + p_amount,
        updated_at = now();
end;
$$;

revoke execute on function public._bump_tournament_volume(uuid, bigint) from public;

create or replace function public._activity_feed_on_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_q    text;
begin
  if new.side is null then return new; end if;

  select display_name into v_name from public.profiles where id = new.user_id;
  select question into v_q from public.markets where id = new.market_id;

  insert into public.activity_feed (
    kind, user_id, market_id, display_name, market_question, amount, side
  ) values (
    'trade',
    new.user_id,
    new.market_id,
    coalesce(v_name, 'Anonymous'),
    left(coalesce(v_q, 'a market'), 120),
    abs(new.cost),
    new.side::text
  );

  perform public._bump_quest_progress(new.user_id, 'bets_placed', 1);
  perform public._bump_quest_progress(new.user_id, 'vibe_wagered', abs(new.cost)::int);
  perform public._bump_tournament_volume(new.user_id, abs(new.cost));

  return new;
end;
$$;

drop trigger if exists activity_feed_on_trade on public.trades;
create trigger activity_feed_on_trade
  after insert on public.trades
  for each row execute function public._activity_feed_on_trade();

-- Prune old feed rows (keep ~48h) on each insert batch via occasional delete
create or replace function public._prune_activity_feed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_feed
   where created_at < now() - interval '48 hours';
  return null;
end;
$$;

drop trigger if exists prune_activity_feed on public.activity_feed;
create trigger prune_activity_feed
  after insert on public.activity_feed
  for each statement execute function public._prune_activity_feed();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_activity_feed(p_limit int default 20)
returns table (
  id              uuid,
  kind            text,
  user_id         uuid,
  market_id       uuid,
  display_name    text,
  market_question text,
  amount          bigint,
  side            text,
  created_at      timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    f.id, f.kind, f.user_id, f.market_id, f.display_name,
    f.market_question, f.amount, f.side, f.created_at
  from public.activity_feed f
  order by f.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.get_activity_feed(int) from public;
grant  execute on function public.get_activity_feed(int) to authenticated, anon;

create or replace function public.get_weekly_quests()
returns table (
  quest_id      text,
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
  v_week    date := public._week_start(now());
begin
  if v_user_id is null then
    return query
      select q.id, q.title, q.description, q.target, q.reward_vibe,
             0, false, false
        from public.quest_definitions q
       where q.active = true
       order by q.sort_order;
    return;
  end if;

  return query
    select
      q.id,
      q.title,
      q.description,
      q.target,
      q.reward_vibe,
      coalesce(p.progress, 0),
      coalesce(p.completed_at is not null, false),
      coalesce(p.claimed_at is not null, false)
    from public.quest_definitions q
    left join public.user_quest_progress p
      on p.quest_id = q.id
     and p.user_id = v_user_id
     and p.period_start = v_week
   where q.active = true
   order by q.sort_order;
end;
$$;

revoke execute on function public.get_weekly_quests() from public;
grant  execute on function public.get_weekly_quests() to authenticated, anon;

create or replace function public.claim_quest_reward(p_quest_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_week      date := public._week_start(now());
  v_quest     public.quest_definitions%rowtype;
  v_progress  public.user_quest_progress%rowtype;
  v_wallet    uuid;
  v_mint      uuid;
  v_tx_id     uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_quest from public.quest_definitions
   where id = p_quest_id and active = true;
  if not found then raise exception 'quest not found'; end if;

  select * into v_progress from public.user_quest_progress
   where user_id = v_user_id and quest_id = p_quest_id and period_start = v_week
   for update;
  if not found or v_progress.completed_at is null then
    raise exception 'quest not completed';
  end if;
  if v_progress.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then raise exception 'wallet not found'; end if;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'platform_mint';
  if v_mint is null then
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  end if;
  if v_mint is null then raise exception 'mint account missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'quest_reward',
    'quest_reward:' || v_user_id::text || ':' || p_quest_id || ':' || v_week::text,
    jsonb_build_object('quest_id', p_quest_id, 'period_start', v_week),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, v_quest.reward_vibe, 'vibe'),
    (v_tx_id, v_mint, -v_quest.reward_vibe, 'vibe');

  update public.user_quest_progress
     set claimed_at = now()
   where user_id = v_user_id and quest_id = p_quest_id and period_start = v_week;

  return v_quest.reward_vibe;
end;
$$;

revoke execute on function public.claim_quest_reward(text) from public;
grant  execute on function public.claim_quest_reward(text) to authenticated;

create or replace function public.get_active_tournament()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_t public.tournaments%rowtype;
begin
  select * into v_t from public.tournaments
   where status = 'active' and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1;

  if not found then return '{}'::jsonb; end if;

  return jsonb_build_object(
    'id', v_t.id,
    'slug', v_t.slug,
    'title', v_t.title,
    'description', v_t.description,
    'starts_at', v_t.starts_at,
    'ends_at', v_t.ends_at,
    'prize_pool', v_t.prize_pool
  );
end;
$$;

revoke execute on function public.get_active_tournament() from public;
grant  execute on function public.get_active_tournament() to authenticated, anon;

create or replace function public.get_tournament_leaderboard(p_limit int default 25)
returns table (
  rank         int,
  user_id      uuid,
  display_name text,
  volume       bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_tournament_id uuid;
begin
  select (public.get_active_tournament()->>'id')::uuid into v_tournament_id;
  if v_tournament_id is null then return; end if;

  return query
    select
      row_number() over (order by s.volume desc)::int,
      s.user_id,
      coalesce(p.display_name, 'Anonymous'),
      s.volume
    from public.tournament_scores s
    left join public.profiles p on p.id = s.user_id
    where s.tournament_id = v_tournament_id
    order by s.volume desc
    limit greatest(1, least(p_limit, 100));
end;
$$;

revoke execute on function public.get_tournament_leaderboard(int) from public;
grant  execute on function public.get_tournament_leaderboard(int) to authenticated, anon;

insert into public.feature_flags (key, enabled, description)
values
  ('live_feed_enabled', false, 'Live trade ticker on home and market pages'),
  ('weekly_quests_enabled', false, 'Weekly quest board with VIBE rewards'),
  ('tournaments_enabled', false, 'Weekly volume tournament leaderboard')
on conflict (key) do update set description = excluded.description;
