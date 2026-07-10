-- =============================================================================
-- Phase 45: HustleOS Phase A — Spark platform tasks + Play hub support
-- =============================================================================

alter table public.daily_hustle_definitions
  add column if not exists task_kind text not null default 'daily';

alter table public.daily_hustle_definitions
  drop constraint if exists daily_hustle_definitions_task_kind_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_task_kind_check
  check (task_kind in ('daily', 'spark'));

alter table public.daily_hustle_definitions
  drop constraint if exists daily_hustle_definitions_metric_check;

alter table public.daily_hustle_definitions
  add constraint daily_hustle_definitions_metric_check
  check (metric in (
    'login', 'bets', 'comments', 'court_votes', 'duel_wins',
    'platform_tag', 'platform_write', 'platform_share'
  ));

insert into public.daily_hustle_definitions
  (id, title, description, metric, target, reward_vibe, sort_order, task_kind)
values
  (
    'spark_tag_images',
    'Tag 10 images',
    'Label each image as cat or dog — takes about 30 seconds.',
    'platform_tag',
    10,
    50,
    101,
    'spark'
  ),
  (
    'spark_write_50',
    'Write 50 words',
    'Describe your side hustle idea in at least 50 words.',
    'platform_write',
    50,
    75,
    102,
    'spark'
  ),
  (
    'spark_share_x',
    'Share on X',
    'Post about earning on VibeBet and confirm when done.',
    'platform_share',
    1,
    40,
    103,
    'spark'
  ),
  (
    'spark_three_bets',
    'Place 3 bets',
    'Make three bets on any market, duel, or live window today.',
    'bets',
    3,
    60,
    104,
    'spark'
  ),
  (
    'spark_win_duel',
    'Win a duel',
    'Win any head-to-head skill game or prediction duel today.',
    'duel_wins',
    1,
    100,
    105,
    'spark'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target = excluded.target,
  reward_vibe = excluded.reward_vibe,
  sort_order = excluded.sort_order,
  task_kind = excluded.task_kind,
  active = true;

create or replace function public.get_daily_hustle(p_task_kind text default null)
returns table (
  task_id       text,
  title         text,
  description   text,
  target        int,
  reward_vibe   bigint,
  progress      int,
  completed     boolean,
  claimed       boolean,
  task_kind     text,
  metric        text
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
      coalesce(p.claimed_at is not null, false),
      d.task_kind,
      d.metric
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

drop function if exists public.get_daily_hustle();

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
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_task
  from public.daily_hustle_definitions
  where id = p_task_id and active = true and task_kind = 'spark';

  if not found then
    raise exception 'unknown spark task';
  end if;
  if v_task.metric not in ('platform_tag', 'platform_write', 'platform_share') then
    raise exception 'task is not manually completable';
  end if;

  perform public._tick_daily_hustle(v_user_id, v_task.metric, p_amount);

  return jsonb_build_object('ok', true, 'task_id', p_task_id);
end;
$$;

revoke execute on function public.submit_spark_hustle_progress(text, int) from public;
grant execute on function public.submit_spark_hustle_progress(text, int) to authenticated;

-- Tick spark progress for platform_submit tasks only (metric alias routing).
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

-- Duel win → spark task progress
create or replace function public._after_duel_win_hustle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.winner_id is not null
     and (old.winner_id is distinct from new.winner_id or old.status is distinct from new.status)
     and new.status = 'settled'
  then
    perform public._tick_daily_hustle(new.winner_id, 'duel_wins', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists duels_hustle_win on public.duels;
create trigger duels_hustle_win
  after update on public.duels
  for each row execute function public._after_duel_win_hustle();

create or replace function public._settle_skill_duel(
  p_escrow_code   text,
  p_winner_id     uuid,
  p_creator_id    uuid,
  p_opponent_id   uuid,
  p_stake         bigint,
  p_is_friendly   boolean,
  p_game_key      text,
  p_is_draw       boolean,
  p_tx_kind       text,
  p_tx_ref        text,
  p_metadata      jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pool   bigint;
  v_payout bigint;
  v_escrow uuid;
  v_wallet uuid;
  v_mint   uuid;
  v_tx_id  uuid;
  v_loser  uuid;
begin
  if p_stake <= 0 then
    if not p_is_draw and p_winner_id is not null and not p_is_friendly then
      v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
      perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
      perform public._tick_daily_hustle(p_winner_id, 'duel_wins', 1);
    elsif p_is_draw and not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;

  if p_is_draw then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (p_tx_kind || '_draw', p_tx_ref || ':draw', p_metadata, p_creator_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_creator_id), p_stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_opponent_id), p_stake, 'vibe');
    if not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  select public._wallet_for_user(p_winner_id) into v_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_tx_kind, p_tx_ref, p_metadata || jsonb_build_object('winner_id', p_winner_id), p_winner_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  if not p_is_friendly then
    v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
    perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
  end if;

  if p_winner_id is not null then
    perform public._tick_daily_hustle(p_winner_id, 'duel_wins', 1);
  end if;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values
  ('play_hub_enabled', false, 'Unified /play hub — Live, Duels, Vibe, Hustle, Watch'),
  ('hustle_spark_enabled', false, 'HustleOS Spark platform tasks in Play hub')
on conflict (key) do update set
  description = excluded.description;
