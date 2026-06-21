-- =============================================================================
-- Phase 14: Limit orders — buy when odds hit your target price
-- =============================================================================

create table if not exists public.limit_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  market_id        uuid not null references public.markets(id) on delete cascade,
  side             public.trade_side not null,
  limit_price      numeric not null check (limit_price > 0 and limit_price < 1),
  stake            bigint not null check (stake >= 10 and stake <= 100000),
  status           text not null default 'open'
    check (status in ('open', 'filled', 'cancelled', 'expired')),
  filled_trade_id  uuid references public.trades(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  filled_at        timestamptz,
  cancelled_at     timestamptz
);

create index if not exists limit_orders_user_idx
  on public.limit_orders (user_id, status, created_at desc);

create index if not exists limit_orders_market_open_idx
  on public.limit_orders (market_id, status)
  where status = 'open';

alter table public.limit_orders enable row level security;

drop policy if exists limit_orders_select_own on public.limit_orders;
create policy limit_orders_select_own on public.limit_orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists limit_orders_insert_own on public.limit_orders;
create policy limit_orders_insert_own on public.limit_orders
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Escrow helpers
-- ---------------------------------------------------------------------------
create or replace function public._limit_order_escrow_code(p_order_id uuid)
returns text
language sql
immutable
as $$
  select 'limit_order_escrow:' || p_order_id::text;
$$;

create or replace function public._side_price(
  p_side        public.trade_side,
  p_reserve_yes bigint,
  p_reserve_no  bigint
) returns numeric
language sql
immutable
as $$
  select case
    when p_side = 'yes' then
      p_reserve_no::numeric / nullif(p_reserve_yes + p_reserve_no, 0)
    else
      p_reserve_yes::numeric / nullif(p_reserve_yes + p_reserve_no, 0)
  end;
$$;

create or replace function public._escrow_limit_order_stake(
  p_user_id   uuid,
  p_order_id  uuid,
  p_stake     bigint
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet uuid;
  v_escrow uuid;
  v_balance bigint;
  v_tx_id  uuid;
begin
  select public._wallet_for_user(p_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then
    raise exception 'insufficient VIBE: need %, have %', p_stake, v_balance;
  end if;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', public._limit_order_escrow_code(p_order_id))
  returning id into v_escrow;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'limit_order_escrow',
    'limit_order_escrow:' || p_order_id::text,
    jsonb_build_object('order_id', p_order_id, 'stake', p_stake),
    p_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'),
    (v_tx_id, v_escrow,  p_stake, 'vibe');
end;
$$;

revoke execute on function public._escrow_limit_order_stake(uuid, uuid, bigint) from public;

create or replace function public._refund_limit_order_escrow(
  p_user_id  uuid,
  p_order_id uuid,
  p_stake    bigint,
  p_kind     text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet uuid;
  v_escrow uuid;
  v_tx_id  uuid;
begin
  select public._wallet_for_user(p_user_id) into v_wallet;
  if v_wallet is null then return; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn'
     and currency = 'vibe'
     and code = public._limit_order_escrow_code(p_order_id);
  if v_escrow is null then return; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    p_kind,
    p_kind || ':' || p_order_id::text,
    jsonb_build_object('order_id', p_order_id),
    p_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -p_stake, 'vibe'),
    (v_tx_id, v_wallet,  p_stake, 'vibe');
end;
$$;

revoke execute on function public._refund_limit_order_escrow(uuid, uuid, bigint, text) from public;

-- Fill one order using escrowed VIBE (mirrors _place_trade_for_user funding source)
create or replace function public._fill_limit_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order           public.limit_orders%rowtype;
  v_market          public.markets%rowtype;
  v_escrow          uuid;
  v_market_pool     uuid;
  v_creator_wallet  uuid;
  v_escrow_balance  bigint;
  v_side_price      numeric;
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
  v_cost            bigint;
begin
  select * into v_order from public.limit_orders
   where id = p_order_id and status = 'open'
   for update;
  if not found then return false; end if;
  if v_order.expires_at <= now() then
    perform public._refund_limit_order_escrow(
      v_order.user_id, v_order.id, v_order.stake, 'limit_order_expire'
    );
    update public.limit_orders set status = 'expired' where id = p_order_id;
    return false;
  end if;

  select * into v_market from public.markets
   where id = v_order.market_id for update;
  if v_market.status <> 'open' then
    perform public._refund_limit_order_escrow(
      v_order.user_id, v_order.id, v_order.stake, 'limit_order_market_closed'
    );
    update public.limit_orders set status = 'cancelled', cancelled_at = now()
     where id = p_order_id;
    return false;
  end if;

  v_side_price := public._side_price(v_order.side, v_market.reserve_yes, v_market.reserve_no);
  if v_side_price is null or v_side_price > v_order.limit_price then
    return false;
  end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn'
     and currency = 'vibe'
     and code = public._limit_order_escrow_code(p_order_id);
  if v_escrow is null then return false; end if;

  select coalesce(sum(amount), 0) into v_escrow_balance
    from public.ledger_entries where account_id = v_escrow;
  if v_escrow_balance < v_order.stake then return false; end if;

  v_cost := v_order.stake;

  select id into v_market_pool from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || v_order.market_id::text;
  if v_market_pool is null then return false; end if;

  v_entry_yes_prob := v_market.reserve_no::numeric
    / nullif(v_market.reserve_yes + v_market.reserve_no, 0);

  v_fee := 0;
  if coalesce(v_market.creator_fee_bps, 0) > 0
     and v_market.creator_id is not null
     and v_market.creator_id <> v_order.user_id then
    v_fee := greatest(1, (v_cost * v_market.creator_fee_bps) / 10000);
  end if;
  v_net_cost := v_cost - v_fee;

  if v_order.side = 'yes' then
    v_reserve_in := v_market.reserve_yes; v_reserve_out := v_market.reserve_no;
  else
    v_reserve_in := v_market.reserve_no; v_reserve_out := v_market.reserve_yes;
  end if;

  v_k := v_reserve_in::numeric * v_reserve_out::numeric;
  v_shares := floor(v_reserve_in + v_net_cost - v_k / (v_reserve_out + v_net_cost))::bigint;
  if v_shares <= 0 then return false; end if;

  if v_order.side = 'yes' then
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
    'limit_order_fill',
    'limit_order_fill:' || p_order_id::text,
    jsonb_build_object(
      'order_id', p_order_id,
      'market_id', v_order.market_id,
      'side', v_order.side,
      'limit_price', v_order.limit_price,
      'stake', v_cost
    ),
    v_order.user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_cost, 'vibe'),
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
   where id = v_order.market_id;

  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id, entry_yes_prob
  ) values (
    v_order.market_id, v_order.user_id, v_order.side, v_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id, v_entry_yes_prob
  ) returning id into v_trade_id;

  insert into public.positions (market_id, user_id, yes_shares, no_shares, total_cost)
  values (
    v_order.market_id, v_order.user_id,
    case when v_order.side = 'yes' then v_shares else 0 end,
    case when v_order.side = 'no'  then v_shares else 0 end,
    v_cost
  )
  on conflict (market_id, user_id) do update set
    yes_shares = public.positions.yes_shares + case when v_order.side = 'yes' then v_shares else 0 end,
    no_shares  = public.positions.no_shares  + case when v_order.side = 'no'  then v_shares else 0 end,
    total_cost = public.positions.total_cost + v_cost,
    updated_at = now();

  update public.limit_orders
     set status = 'filled',
         filled_trade_id = v_trade_id,
         filled_at = now()
   where id = p_order_id;

  perform public._record_first_bet(v_order.user_id, v_order.market_id);
  perform public.check_achievements(v_order.user_id);

  return true;
end;
$$;

revoke execute on function public._fill_limit_order(uuid) from public;

create or replace function public._try_fill_limit_orders(p_market_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   record;
  v_filled  int := 0;
  v_round   int;
  v_did     boolean;
begin
  for v_round in 1..10 loop
    v_did := false;
    for v_order in
      select id from public.limit_orders
       where market_id = p_market_id
         and status = 'open'
         and expires_at > now()
       order by created_at
       for update skip locked
    loop
      if public._fill_limit_order(v_order.id) then
        v_filled := v_filled + 1;
        v_did := true;
      end if;
    end loop;
    exit when not v_did;
  end loop;

  -- Expire stale open orders
  for v_order in
    select id, user_id, stake from public.limit_orders
     where market_id = p_market_id
       and status = 'open'
       and expires_at <= now()
     for update
  loop
    perform public._refund_limit_order_escrow(
      v_order.user_id, v_order.id, v_order.stake, 'limit_order_expire'
    );
    update public.limit_orders set status = 'expired' where id = v_order.id;
  end loop;

  return v_filled;
end;
$$;

revoke execute on function public._try_fill_limit_orders(uuid) from public;

create or replace function public._limit_orders_on_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.side is not null then
    perform public._try_fill_limit_orders(new.market_id);
  end if;
  return new;
end;
$$;

drop trigger if exists limit_orders_on_trade on public.trades;
create trigger limit_orders_on_trade
  after insert on public.trades
  for each row execute function public._limit_orders_on_trade();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_limit_order(
  p_market_id    uuid,
  p_side         public.trade_side,
  p_limit_price  numeric,
  p_stake        bigint,
  p_expires_days int default 7
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_market  public.markets%rowtype;
  v_order_id uuid;
  v_side_price numeric;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 100000 then
    raise exception 'stake must be 10–100,000 VIBE';
  end if;
  if p_limit_price <= 0 or p_limit_price >= 1 then
    raise exception 'limit price must be between 0 and 1';
  end if;
  if p_expires_days < 1 or p_expires_days > 30 then
    raise exception 'expiry must be 1–30 days';
  end if;

  select * into v_market from public.markets where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then raise exception 'market not open'; end if;
  if v_market.kind <> 'binary' then raise exception 'limit orders only on binary markets'; end if;

  v_side_price := public._side_price(p_side, v_market.reserve_yes, v_market.reserve_no);
  if v_side_price <= p_limit_price then
    raise exception 'price already at or below your limit — place a market bet instead';
  end if;

  insert into public.limit_orders (
    user_id, market_id, side, limit_price, stake, expires_at
  ) values (
    v_user_id,
    p_market_id,
    p_side,
    p_limit_price,
    p_stake,
    now() + (p_expires_days || ' days')::interval
  ) returning id into v_order_id;

  perform public._escrow_limit_order_stake(v_user_id, v_order_id, p_stake);

  perform public.check_achievements(v_user_id);

  return v_order_id;
end;
$$;

revoke execute on function public.create_limit_order(uuid, public.trade_side, numeric, bigint, int) from public;
grant  execute on function public.create_limit_order(uuid, public.trade_side, numeric, bigint, int) to authenticated;

create or replace function public.cancel_limit_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order   public.limit_orders%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_order from public.limit_orders
   where id = p_order_id and user_id = v_user_id
   for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'open' then raise exception 'order is not open'; end if;

  perform public._refund_limit_order_escrow(
    v_user_id, v_order.id, v_order.stake, 'limit_order_cancel'
  );

  update public.limit_orders
     set status = 'cancelled', cancelled_at = now()
   where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_limit_order(uuid) from public;
grant  execute on function public.cancel_limit_order(uuid) to authenticated;

create or replace function public.get_my_limit_orders(p_limit int default 30)
returns table (
  id              uuid,
  market_id       uuid,
  market_question text,
  side            public.trade_side,
  limit_price     numeric,
  stake           bigint,
  status          text,
  created_at      timestamptz,
  expires_at      timestamptz,
  filled_at       timestamptz
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
      lo.id,
      lo.market_id,
      left(m.question, 120),
      lo.side,
      lo.limit_price,
      lo.stake,
      lo.status,
      lo.created_at,
      lo.expires_at,
      lo.filled_at
    from public.limit_orders lo
    join public.markets m on m.id = lo.market_id
    where lo.user_id = v_user_id
    order by lo.created_at desc
    limit greatest(1, least(p_limit, 100));
end;
$$;

revoke execute on function public.get_my_limit_orders(int) from public;
grant  execute on function public.get_my_limit_orders(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('limit_orders_enabled', false, 'Escrowed limit buy orders on binary markets')
on conflict (key) do update set description = excluded.description;

-- Limit order achievement
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
  v_limit_fill int;
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
  select count(*)::int into v_limit_fill from public.limit_orders
   where user_id = p_user_id and status = 'filled';

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

  if v_limit_fill >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_limit_fill') on conflict do nothing;
  end if;

  return v_count;
end;
$$;
