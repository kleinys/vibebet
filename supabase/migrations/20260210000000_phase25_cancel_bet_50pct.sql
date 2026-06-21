-- =============================================================================
-- Phase 25: Cancel bet — 50% of cost basis back (50% fee), all open markets
-- =============================================================================

create or replace function public.quick_exit_shares(
  p_market_id uuid,
  p_side      public.trade_side,
  p_shares    bigint
) returns table (
  trade_id   uuid,
  proceeds   bigint,
  fee        bigint,
  cost_basis bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_market       public.markets%rowtype;
  v_user_wallet  uuid;
  v_market_pool  uuid;
  v_position     public.positions%rowtype;
  v_owned        bigint;
  v_total_shares bigint;
  v_cost_basis   bigint;
  v_proceeds     bigint;
  v_fee          bigint;
  v_pool_balance bigint;
  v_tx_id        uuid;
  v_trade_id     uuid;
  v_payout_bps   int := 5000; -- 50% back, 50% fee
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_shares <= 0 then raise exception 'shares must be positive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then raise exception 'market not open'; end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed';
  end if;
  if v_market.fast_asset is not null
     and v_market.window_end is not null
     and v_market.window_end <= now() then
    raise exception 'window has ended — wait for auto-resolution';
  end if;

  select * into v_position from public.positions
   where market_id = p_market_id and user_id = v_user_id for update;
  if not found then raise exception 'no position'; end if;

  v_owned := case when p_side = 'yes' then v_position.yes_shares else v_position.no_shares end;
  if v_owned < p_shares then
    raise exception 'not enough shares: have %, need %', v_owned, p_shares;
  end if;

  v_total_shares := v_position.yes_shares + v_position.no_shares;
  if v_total_shares <= 0 then raise exception 'empty position'; end if;

  v_cost_basis := floor(v_position.total_cost::numeric * p_shares / v_total_shares)::bigint;
  if v_cost_basis <= 0 then raise exception 'no cost basis to cancel'; end if;

  v_proceeds := floor(v_cost_basis::numeric * v_payout_bps / 10000)::bigint;
  v_fee := v_cost_basis - v_proceeds;
  if v_proceeds <= 0 then raise exception 'proceeds too small'; end if;

  select id into v_user_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  select id into v_market_pool from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = 'market_pool:' || p_market_id::text;
  if v_user_wallet is null or v_market_pool is null then raise exception 'accounts missing'; end if;

  select coalesce(sum(amount), 0) into v_pool_balance
    from public.ledger_entries where account_id = v_market_pool;
  if v_pool_balance < v_proceeds then
    raise exception 'market pool cannot cover cancel right now';
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'cancel_bet',
    'cancel_bet:' || gen_random_uuid()::text,
    jsonb_build_object(
      'market_id', p_market_id,
      'side', p_side,
      'shares', p_shares,
      'cost_basis', v_cost_basis,
      'proceeds', v_proceeds,
      'fee_bps', 10000 - v_payout_bps
    ),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, v_proceeds, 'vibe'),
    (v_tx_id, v_market_pool, -v_proceeds, 'vibe');

  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id
  ) values (
    p_market_id, v_user_id, p_side, -v_proceeds, p_shares,
    v_market.reserve_yes, v_market.reserve_no, v_tx_id
  ) returning id into v_trade_id;

  update public.positions set
    yes_shares = case when p_side = 'yes' then yes_shares - p_shares else yes_shares end,
    no_shares  = case when p_side = 'no'  then no_shares  - p_shares else no_shares  end,
    total_cost = greatest(0, total_cost - v_cost_basis),
    total_proceeds = total_proceeds + v_proceeds,
    updated_at = now()
  where market_id = p_market_id and user_id = v_user_id;

  return query select v_trade_id, v_proceeds, v_fee, v_cost_basis;
end;
$$;

update public.feature_flags
   set description = 'Cancel bet: get 50% of cost basis back on any open market (50% fee). Works on fast windows too (before timer ends).'
 where key = 'quick_exit_enabled';
