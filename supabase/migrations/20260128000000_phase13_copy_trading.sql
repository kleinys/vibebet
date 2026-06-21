-- =============================================================================
-- Phase 13: Copy trading — follow sharp minds, mirror their bets
-- =============================================================================

create table if not exists public.copy_follows (
  follower_id        uuid not null references auth.users(id) on delete cascade,
  leader_id          uuid not null references auth.users(id) on delete cascade,
  max_stake          bigint not null default 50
    check (max_stake >= 10 and max_stake <= 10000),
  auto_copy          boolean not null default false,
  created_at         timestamptz not null default now(),
  primary key (follower_id, leader_id),
  constraint copy_follows_not_self check (follower_id <> leader_id)
);

create index if not exists copy_follows_leader_idx
  on public.copy_follows (leader_id);

create table if not exists public.copy_trades (
  id               uuid primary key default gen_random_uuid(),
  follower_id      uuid not null references auth.users(id) on delete cascade,
  leader_id        uuid not null references auth.users(id) on delete cascade,
  source_trade_id  uuid not null references public.trades(id) on delete cascade,
  copy_trade_id    uuid not null references public.trades(id) on delete cascade,
  stake            bigint not null check (stake > 0),
  auto             boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists copy_trades_follower_idx
  on public.copy_trades (follower_id, created_at desc);

alter table public.copy_follows enable row level security;
alter table public.copy_trades enable row level security;

drop policy if exists copy_follows_select_own on public.copy_follows;
create policy copy_follows_select_own on public.copy_follows
  for select to authenticated
  using (follower_id = auth.uid() or leader_id = auth.uid());

drop policy if exists copy_follows_mutate_own on public.copy_follows;
create policy copy_follows_mutate_own on public.copy_follows
  for all to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());

drop policy if exists copy_trades_select_own on public.copy_trades;
create policy copy_trades_select_own on public.copy_trades
  for select to authenticated
  using (follower_id = auth.uid() or leader_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Internal trade executor (for copy + auto-copy; mirrors place_trade logic)
-- ---------------------------------------------------------------------------
create or replace function public._place_trade_for_user(
  p_user_id   uuid,
  p_market_id uuid,
  p_side      public.trade_side,
  p_cost      bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market          public.markets%rowtype;
  v_user_wallet     uuid;
  v_creator_wallet  uuid;
  v_market_pool     uuid;
  v_balance         bigint;
  v_reserve_in      bigint;
  v_reserve_out     bigint;
  v_k               numeric;
  v_shares          bigint;
  v_new_in          bigint;
  v_new_out         bigint;
  v_tx_id           uuid;
  v_trade_id        uuid;
  v_yes_after       bigint;
  v_no_after        bigint;
  v_fee             bigint;
  v_net_cost        bigint;
  v_entry_yes_prob  numeric;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then
    raise exception 'market not open';
  end if;
  if v_market.kind <> 'binary' then
    raise exception 'copy trading only on binary markets';
  end if;
  if v_market.fast_asset is not null and v_market.window_end is not null
     and v_market.window_end <= now() then
    raise exception 'fast market window ended';
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed';
  end if;

  v_entry_yes_prob := v_market.reserve_no::numeric
    / nullif(v_market.reserve_yes + v_market.reserve_no, 0);

  select id into v_user_wallet from public.accounts
   where owner_user_id = p_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < p_cost then
    raise exception 'insufficient balance';
  end if;

  select id into v_market_pool from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_market_pool is null then raise exception 'market pool missing'; end if;

  v_fee := 0;
  if coalesce(v_market.creator_fee_bps, 0) > 0
     and v_market.creator_id is not null
     and v_market.creator_id <> p_user_id then
    v_fee := greatest(1, (p_cost * v_market.creator_fee_bps) / 10000);
  end if;
  v_net_cost := p_cost - v_fee;

  if p_side = 'yes' then
    v_reserve_in := v_market.reserve_yes; v_reserve_out := v_market.reserve_no;
  else
    v_reserve_in := v_market.reserve_no; v_reserve_out := v_market.reserve_yes;
  end if;

  v_k := v_reserve_in::numeric * v_reserve_out::numeric;
  v_shares := floor(v_reserve_in + v_net_cost - v_k / (v_reserve_out + v_net_cost))::bigint;
  if v_shares <= 0 then raise exception 'computed shares non-positive'; end if;

  if p_side = 'yes' then
    v_new_in := v_reserve_in + v_net_cost - v_shares;
    v_new_out := v_reserve_out + v_net_cost;
    v_yes_after := v_new_in; v_no_after := v_new_out;
  else
    v_new_in := v_reserve_in + v_net_cost - v_shares;
    v_new_out := v_reserve_out + v_net_cost;
    v_yes_after := v_new_out; v_no_after := v_new_in;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_trade',
    'market_trade:' || gen_random_uuid()::text,
    jsonb_build_object(
      'market_id', p_market_id, 'side', p_side, 'cost', p_cost,
      'shares', v_shares, 'creator_fee', v_fee,
      'entry_yes_prob', v_entry_yes_prob, 'copied', true
    ),
    p_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_cost, 'vibe'),
    (v_tx_id, v_market_pool, v_net_cost, 'vibe');

  if v_fee > 0 then
    select id into v_creator_wallet from public.accounts
     where owner_user_id = v_market.creator_id
       and kind = 'user_wallet' and currency = 'vibe';
    if v_creator_wallet is not null then
      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      values (v_tx_id, v_creator_wallet, v_fee, 'vibe');
    else
      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      values (v_tx_id, v_market_pool, v_fee, 'vibe');
    end if;
  end if;

  update public.markets
     set reserve_yes = v_yes_after, reserve_no = v_no_after
   where id = p_market_id;

  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id, entry_yes_prob
  ) values (
    p_market_id, p_user_id, p_side, p_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id, v_entry_yes_prob
  ) returning id into v_trade_id;

  insert into public.positions (market_id, user_id, yes_shares, no_shares, total_cost)
  values (
    p_market_id, p_user_id,
    case when p_side = 'yes' then v_shares else 0 end,
    case when p_side = 'no'  then v_shares else 0 end,
    p_cost
  )
  on conflict (market_id, user_id) do update set
    yes_shares = public.positions.yes_shares + case when p_side = 'yes' then v_shares else 0 end,
    no_shares  = public.positions.no_shares  + case when p_side = 'no'  then v_shares else 0 end,
    total_cost = public.positions.total_cost + p_cost,
    updated_at = now();

  perform public._record_first_bet(p_user_id, p_market_id);

  return v_trade_id;
end;
$$;

revoke execute on function public._place_trade_for_user(uuid, uuid, public.trade_side, bigint) from public;

-- Auto-copy when leaders trade
create or replace function public._auto_copy_on_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follow   record;
  v_stake    bigint;
  v_copy_id  uuid;
begin
  if new.side is null or new.cost <= 0 then return new; end if;

  for v_follow in
    select cf.follower_id, cf.max_stake
      from public.copy_follows cf
     where cf.leader_id = new.user_id
       and cf.auto_copy = true
  loop
    begin
      v_stake := least(new.cost, v_follow.max_stake);
      v_copy_id := public._place_trade_for_user(
        v_follow.follower_id, new.market_id, new.side, v_stake
      );
      insert into public.copy_trades (
        follower_id, leader_id, source_trade_id, copy_trade_id, stake, auto
      ) values (
        v_follow.follower_id, new.user_id, new.id, v_copy_id, v_stake, true
      );
    exception when others then
      null; -- skip follower if balance/market constraints fail
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists auto_copy_on_trade on public.trades;
create trigger auto_copy_on_trade
  after insert on public.trades
  for each row execute function public._auto_copy_on_trade();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.follow_trader(
  p_username  text,
  p_max_stake bigint default 50,
  p_auto_copy boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_leader_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_max_stake < 10 or p_max_stake > 10000 then
    raise exception 'max stake must be 10–10,000 VIBE';
  end if;

  select id into v_leader_id from public.profiles
   where lower(username) = lower(trim(p_username));
  if v_leader_id is null then raise exception 'trader not found'; end if;
  if v_leader_id = v_user_id then raise exception 'cannot follow yourself'; end if;

  insert into public.copy_follows (follower_id, leader_id, max_stake, auto_copy)
  values (v_user_id, v_leader_id, p_max_stake, p_auto_copy)
  on conflict (follower_id, leader_id) do update set
    max_stake = excluded.max_stake,
    auto_copy = excluded.auto_copy;

  return v_leader_id;
end;
$$;

revoke execute on function public.follow_trader(text, bigint, boolean) from public;
grant  execute on function public.follow_trader(text, bigint, boolean) to authenticated;

create or replace function public.unfollow_trader(p_leader_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  delete from public.copy_follows
   where follower_id = v_user_id and leader_id = p_leader_id;
end;
$$;

revoke execute on function public.unfollow_trader(uuid) from public;
grant  execute on function public.unfollow_trader(uuid) to authenticated;

create or replace function public.copy_trade(
  p_source_trade_id uuid,
  p_stake           bigint default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_source    public.trades%rowtype;
  v_stake     bigint;
  v_copy_id   uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_source from public.trades where id = p_source_trade_id;
  if not found then raise exception 'trade not found'; end if;
  if v_source.user_id = v_user_id then raise exception 'cannot copy your own trade'; end if;
  if v_source.side is null or v_source.cost <= 0 then
    raise exception 'can only copy buy trades';
  end if;

  v_stake := coalesce(p_stake, v_source.cost);
  if v_stake < 10 or v_stake > 100000 then
    raise exception 'stake must be 10–100,000 VIBE';
  end if;

  v_copy_id := public._place_trade_for_user(
    v_user_id, v_source.market_id, v_source.side, v_stake
  );

  insert into public.copy_trades (
    follower_id, leader_id, source_trade_id, copy_trade_id, stake, auto
  ) values (
    v_user_id, v_source.user_id, p_source_trade_id, v_copy_id, v_stake, false
  );

  return v_copy_id;
end;
$$;

revoke execute on function public.copy_trade(uuid, bigint) from public;
grant  execute on function public.copy_trade(uuid, bigint) to authenticated;

create or replace function public.get_my_following()
returns table (
  leader_id      uuid,
  display_name   text,
  username       text,
  max_stake      bigint,
  auto_copy      boolean,
  follower_count bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;

  return query
    select
      cf.leader_id,
      coalesce(p.display_name, 'Anonymous'),
      p.username,
      cf.max_stake,
      cf.auto_copy,
      (select count(*) from public.copy_follows c2 where c2.leader_id = cf.leader_id)
    from public.copy_follows cf
    left join public.profiles p on p.id = cf.leader_id
    where cf.follower_id = v_user_id
    order by cf.created_at desc;
end;
$$;

revoke execute on function public.get_my_following() from public;
grant  execute on function public.get_my_following() to authenticated;

create or replace function public.get_copyable_trades(p_limit int default 20)
returns table (
  trade_id         uuid,
  leader_id        uuid,
  display_name     text,
  market_id        uuid,
  market_question  text,
  side             public.trade_side,
  stake            bigint,
  created_at       timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    t.id,
    t.user_id,
    coalesce(p.display_name, 'Anonymous'),
    t.market_id,
    left(m.question, 120),
    t.side,
    t.cost,
    t.created_at
  from public.trades t
  join public.markets m on m.id = t.market_id
  left join public.profiles p on p.id = t.user_id
  where t.side is not null
    and t.cost > 0
    and m.status = 'open'
    and m.kind = 'binary'
  order by t.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.get_copyable_trades(int) from public;
grant  execute on function public.get_copyable_trades(int) to authenticated, anon;

create or replace function public.copy_trader_leaderboard(p_limit int default 20)
returns table (
  rank           int,
  user_id        uuid,
  display_name   text,
  username       text,
  follower_count bigint,
  copies_received bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    row_number() over (order by fc.cnt desc)::int,
    fc.leader_id,
    coalesce(p.display_name, 'Anonymous'),
    p.username,
    fc.cnt,
    coalesce(cc.cnt, 0)
  from (
    select leader_id, count(*)::bigint as cnt
      from public.copy_follows
     group by leader_id
  ) fc
  left join public.profiles p on p.id = fc.leader_id
  left join (
    select leader_id, count(*)::bigint as cnt
      from public.copy_trades
     group by leader_id
  ) cc on cc.leader_id = fc.leader_id
  order by fc.cnt desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.copy_trader_leaderboard(int) from public;
grant  execute on function public.copy_trader_leaderboard(int) to authenticated, anon;

insert into public.feature_flags (key, enabled, description)
values ('copy_trading_enabled', false, 'Follow traders and mirror their bets')
on conflict (key) do update set description = excluded.description;

-- Copy trading achievement
create or replace function public.check_achievements(p_user_id uuid default auth.uid())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count      int := 0;
  v_streak     int;
  v_trades     int;
  v_markets    int;
  v_comments   int;
  v_scored     int;
  v_correct    int;
  v_accuracy   numeric;
  v_duel_wins  int;
  v_in_guild   boolean;
  v_copies     int;
begin
  if p_user_id is null then return 0; end if;

  select current_streak, predictions_scored, correct_predictions
    into v_streak, v_scored, v_correct
    from public.profiles where id = p_user_id;

  select count(*)::int into v_trades from public.trades where user_id = p_user_id;
  select count(*)::int into v_markets from public.markets where creator_id = p_user_id;
  select count(*)::int into v_comments from public.market_comments where user_id = p_user_id;
  select count(*)::int into v_duel_wins from public.duels
   where winner_id = p_user_id and status = 'settled';
  select exists(select 1 from public.guild_members where user_id = p_user_id)
    into v_in_guild;
  select count(*)::int into v_copies from public.copy_trades
   where follower_id = p_user_id;

  if v_trades >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_trade') on conflict do nothing;
  end if;
  if v_markets >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_market') on conflict do nothing;
  end if;
  if v_comments >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_comment') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 3 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_3') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 7 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_7') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 30 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_30') on conflict do nothing;
  end if;
  if (select coalesce(sum(abs(cost)), 0) from public.trades where user_id = p_user_id) >= 1000 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'volume_1k') on conflict do nothing;
  end if;

  if coalesce(v_scored, 0) >= 10 then
    v_accuracy := v_correct::numeric / v_scored;
    if v_accuracy >= 0.55 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_oracle') on conflict do nothing;
    end if;
    if v_scored >= 50 and v_accuracy >= 0.65 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_prophet') on conflict do nothing;
    end if;
    if v_scored >= 100 and v_accuracy >= 0.75 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_legend') on conflict do nothing;
    end if;
  end if;

  if v_duel_wins >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'duel_first_win') on conflict do nothing;
  end if;
  if v_duel_wins >= 5 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'duel_wins_5') on conflict do nothing;
  end if;

  if v_in_guild then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'guild_member') on conflict do nothing;
  end if;

  if v_copies >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_copy') on conflict do nothing;
  end if;

  return v_count;
end;
$$;
