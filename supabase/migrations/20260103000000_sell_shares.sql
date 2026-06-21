-- =============================================================================
-- Phase 1.1: Sell shares back to the AMM
-- =============================================================================
-- Math (binary CPMM, mirrored in src/lib/cpmm.ts):
--
--   State: (reserve_in, reserve_out), k = reserve_in * reserve_out
--   User returns S shares of `side` (the "in" side).
--   Pool absorbs them:                (reserve_in + S, reserve_out)
--   User withdraws `p` VIBE; matched pair burns from both reserves:
--                                     (reserve_in + S - p, reserve_out - p)
--   Invariant: (reserve_in + S - p)(reserve_out - p) = k
--
--   Let A = reserve_in + S, B = reserve_out, K = reserve_in * reserve_out.
--   Solving p² − (A+B)p + (AB − K) = 0 for the smaller positive root:
--
--     p = ((A + B) − √((A − B)² + 4K)) / 2
--
-- We floor p so the AMM keeps the rounding scrap (same convention as buy).
-- =============================================================================

-- Track sell proceeds separately from settlement payouts on positions.
alter table public.positions
  add column total_proceeds bigint not null default 0
  check (total_proceeds >= 0);

create or replace function public.sell_shares(
  p_market_id uuid,
  p_side      public.trade_side,
  p_shares    bigint
) returns table (
  trade_id          uuid,
  proceeds          bigint,
  reserve_yes_after bigint,
  reserve_no_after  bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_market      public.markets%rowtype;
  v_user_wallet uuid;
  v_market_pool uuid;
  v_position    public.positions%rowtype;
  v_owned       bigint;
  v_reserve_in  bigint;
  v_reserve_out bigint;
  v_k           numeric;
  v_a           numeric;
  v_b           numeric;
  v_proceeds    bigint;
  v_new_in      bigint;
  v_new_out     bigint;
  v_yes_after   bigint;
  v_no_after    bigint;
  v_tx_id       uuid;
  v_trade_id    uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_shares <= 0 then raise exception 'shares must be positive'; end if;

  -- Lock the market row (same pattern as place_trade).
  select * into v_market from public.markets
  where id = p_market_id
  for update;

  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then
    raise exception 'market not open (status=%)', v_market.status;
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed at %', v_market.closes_at;
  end if;

  -- Check the user has enough shares of this side.
  select * into v_position from public.positions
  where market_id = p_market_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'no position in this market';
  end if;

  v_owned := case when p_side = 'yes' then v_position.yes_shares else v_position.no_shares end;
  if v_owned < p_shares then
    raise exception 'not enough shares: have %, sell %', v_owned, p_shares;
  end if;

  select id into v_user_wallet
  from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';

  select id into v_market_pool
  from public.accounts
  where kind = 'system_burn' and currency = 'vibe'
    and code = 'market_pool:' || p_market_id::text;

  if v_market_pool is null then
    raise exception 'market pool account missing';
  end if;

  -- CPMM sell math.
  if p_side = 'yes' then
    v_reserve_in  := v_market.reserve_yes;
    v_reserve_out := v_market.reserve_no;
  else
    v_reserve_in  := v_market.reserve_no;
    v_reserve_out := v_market.reserve_yes;
  end if;

  v_k := v_reserve_in::numeric * v_reserve_out::numeric;
  v_a := v_reserve_in::numeric + p_shares::numeric;
  v_b := v_reserve_out::numeric;

  v_proceeds := floor(
    (v_a + v_b - sqrt(power(v_a - v_b, 2) + 4 * v_k)) / 2
  )::bigint;

  if v_proceeds <= 0 then
    raise exception 'computed proceeds non-positive (try selling more shares)';
  end if;
  if v_proceeds >= v_reserve_out then
    -- Should never happen with valid CPMM state, but a safety rail.
    raise exception 'proceeds would drain the pool';
  end if;

  v_new_in  := v_reserve_in + p_shares - v_proceeds;
  v_new_out := v_reserve_out - v_proceeds;

  if p_side = 'yes' then
    v_yes_after := v_new_in;
    v_no_after  := v_new_out;
  else
    v_yes_after := v_new_out;
    v_no_after  := v_new_in;
  end if;

  -- Ledger: credit user wallet, debit market pool.
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_sell',
    'market_sell:' || gen_random_uuid()::text,
    jsonb_build_object(
      'market_id', p_market_id,
      'side', p_side,
      'shares', p_shares,
      'proceeds', v_proceeds
    ),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, v_proceeds,  'vibe'),
    (v_tx_id, v_market_pool, -v_proceeds, 'vibe');

  update public.markets
  set reserve_yes = v_yes_after,
      reserve_no  = v_no_after
  where id = p_market_id;

  -- We log sells in the trades table with a negative `cost` to disambiguate
  -- from buys. Some downstream consumers (volume, charts) treat |cost| as
  -- the contribution.
  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id
  ) values (
    p_market_id, v_user_id, p_side, -v_proceeds, p_shares,
    v_yes_after, v_no_after, v_tx_id
  )
  returning id into v_trade_id;

  -- Update position: subtract sold shares, add to total_proceeds.
  update public.positions set
    yes_shares = case when p_side = 'yes' then yes_shares - p_shares else yes_shares end,
    no_shares  = case when p_side = 'no'  then no_shares  - p_shares else no_shares  end,
    total_proceeds = total_proceeds + v_proceeds,
    updated_at = now()
  where market_id = p_market_id and user_id = v_user_id;

  return query select v_trade_id, v_proceeds, v_yes_after, v_no_after;
end;
$$;

-- Relax the cost check on trades since sells are stored as negative cost.
-- Drop the auto-named constraint by looking it up (name varies by PG version).
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.trades'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%cost > 0%';
  if con_name is not null then
    execute format('alter table public.trades drop constraint %I', con_name);
  end if;
end $$;

alter table public.trades
  add constraint trades_cost_nonzero check (cost <> 0);

revoke execute on function public.sell_shares(uuid, public.trade_side, bigint) from public;
grant  execute on function public.sell_shares(uuid, public.trade_side, bigint) to authenticated;
