-- =============================================================================
-- Vibebet Phase 1: Prediction Markets (CPMM)
-- =============================================================================
-- Binary YES/NO markets backed by a constant-product market maker.
--
-- AMM mechanics (Polymarket-style):
--   - Each market has a pool of YES and NO reserves.
--   - Invariant: reserve_yes * reserve_no = k (approximately; rounding shifts
--     k slightly in the AMM's favor each trade, which is the spread).
--   - To buy `shares` of YES for `cost` VIBE:
--       cost is added to both reserves (minting matched YES + NO),
--       then `shares` are removed from the YES side.
--     shares = reserve_yes + cost - (reserve_yes * reserve_no) / (reserve_no + cost)
--   - Phase 1 is BUY-ONLY. Selling shares back to the AMM is Phase 2+.
--   - Settlement pays 1 VIBE per share of the winning side; losing shares burn.
--   - Any residual VIBE in the market pool (subsidy surplus + AMM rounding
--     gains) burns to a system account at resolution.
--
-- Money flow:
--   - Market creation: creator's VIBE wallet → market pool account.
--   - Trade: trader's VIBE wallet → market pool account.
--   - Resolution: market pool account → winners' VIBE wallets, residual → burn.
-- =============================================================================

create type public.market_status as enum (
  'open',      -- accepting trades
  'closed',    -- no more trades, awaiting resolution
  'resolved',  -- outcome set, payouts done
  'voided'     -- canceled, refunded (not used in Phase 1)
);

create type public.trade_side as enum ('yes', 'no');

-- -----------------------------------------------------------------------------
-- Markets
-- -----------------------------------------------------------------------------
create table public.markets (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references auth.users(id) on delete restrict,
  question          text not null check (length(question) between 10 and 280),
  description       text,
  status            public.market_status not null default 'open',
  -- AMM state. BIGINT in 'units' (1 VIBE share = 1 unit). All arithmetic is
  -- integer except the CPMM division, which uses NUMERIC and floors.
  reserve_yes       bigint not null check (reserve_yes > 0),
  reserve_no        bigint not null check (reserve_no > 0),
  -- Initial subsidy provided by creator. Locked in the pool; surplus burns
  -- at resolution.
  subsidy           bigint not null check (subsidy >= 100),
  -- Resolution
  resolved_outcome  boolean,
  resolved_at       timestamptz,
  -- Lifecycle
  closes_at         timestamptz,
  created_at        timestamptz not null default now()
);

create index markets_status_idx     on public.markets (status, created_at desc);
create index markets_creator_idx    on public.markets (creator_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Positions (aggregated holdings per user per market)
-- -----------------------------------------------------------------------------
create table public.positions (
  market_id      uuid not null references public.markets(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  yes_shares     bigint not null default 0 check (yes_shares >= 0),
  no_shares      bigint not null default 0 check (no_shares >= 0),
  total_cost     bigint not null default 0 check (total_cost >= 0),
  total_payout   bigint not null default 0 check (total_payout >= 0),
  updated_at     timestamptz not null default now(),
  primary key (market_id, user_id)
);

create index positions_user_idx on public.positions (user_id);

-- -----------------------------------------------------------------------------
-- Trades (immutable log)
-- -----------------------------------------------------------------------------
create table public.trades (
  id                     uuid primary key default gen_random_uuid(),
  market_id              uuid not null references public.markets(id) on delete restrict,
  user_id                uuid not null references auth.users(id) on delete restrict,
  side                   public.trade_side not null,
  cost                   bigint not null check (cost > 0),
  shares                 bigint not null check (shares > 0),
  reserve_yes_after      bigint not null,
  reserve_no_after       bigint not null,
  ledger_transaction_id  uuid not null references public.ledger_transactions(id),
  created_at             timestamptz not null default now()
);

create index trades_market_idx on public.trades (market_id, created_at desc);
create index trades_user_idx   on public.trades (user_id, created_at desc);

-- Trades are immutable.
create trigger trades_no_mutation
  before update or delete on public.trades
  for each row execute function public.ledger_immutable();

-- -----------------------------------------------------------------------------
-- Helper view: market summary with computed YES price
-- -----------------------------------------------------------------------------
create view public.markets_view
with (security_invoker = true) as
select
  m.*,
  -- Price of YES = reserve_no / (reserve_yes + reserve_no). NUMERIC for
  -- precision; clamp to (0,1).
  (m.reserve_no::numeric / nullif(m.reserve_yes + m.reserve_no, 0))::numeric as yes_price,
  (select coalesce(sum(t.cost), 0) from public.trades t where t.market_id = m.id) as volume,
  (select count(*)::int from public.trades t where t.market_id = m.id) as trade_count
from public.markets m;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.markets   enable row level security;
alter table public.positions enable row level security;
alter table public.trades    enable row level security;

-- Markets: anyone can read. Inserts/updates only via SECURITY DEFINER functions.
create policy markets_read_all on public.markets
  for select to authenticated, anon using (true);

-- Positions: user reads own only. Writes only via SECURITY DEFINER functions.
create policy positions_read_own on public.positions
  for select to authenticated using (user_id = auth.uid());

-- Trades: public to authenticated (transparency is part of the trust model).
-- Inserts only via SECURITY DEFINER functions.
create policy trades_read_authenticated on public.trades
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- RPC: create_market
--   Deducts the subsidy from the creator's VIBE wallet and seeds the AMM.
-- -----------------------------------------------------------------------------
create or replace function public.create_market(
  p_question    text,
  p_description text,
  p_subsidy     bigint,
  p_closes_at   timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_market_id   uuid;
  v_user_wallet uuid;
  v_market_pool uuid;
  v_balance     bigint;
  v_tx_id       uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_subsidy < 100 then
    raise exception 'minimum subsidy is 100 VIBE';
  end if;
  if p_subsidy > 1000000 then
    raise exception 'maximum subsidy is 1,000,000 VIBE';
  end if;
  if length(p_question) < 10 or length(p_question) > 280 then
    raise exception 'question must be 10-280 characters';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'closes_at must be in the future';
  end if;

  select id into v_user_wallet
  from public.accounts
  where owner_user_id = v_user_id
    and kind = 'user_wallet'
    and currency = 'vibe';

  if v_user_wallet is null then
    raise exception 'creator wallet not found';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries
  where account_id = v_user_wallet;

  if v_balance < p_subsidy then
    raise exception 'insufficient balance: have %, need %', v_balance, p_subsidy;
  end if;

  insert into public.markets (
    creator_id, question, description, subsidy,
    reserve_yes, reserve_no, closes_at
  ) values (
    v_user_id, p_question, p_description, p_subsidy,
    p_subsidy, p_subsidy, p_closes_at
  )
  returning id into v_market_id;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'market_pool:' || v_market_id::text)
  returning id into v_market_pool;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_create',
    'market_create:' || v_market_id::text,
    jsonb_build_object('market_id', v_market_id, 'subsidy', p_subsidy),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_subsidy, 'vibe'),
    (v_tx_id, v_market_pool, p_subsidy, 'vibe');

  return v_market_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: place_trade
--   Buy `p_shares_out` of the chosen side by paying `p_cost` VIBE. We always
--   take `p_cost` as input (cleaner UX: "spend X VIBE") and compute shares.
-- -----------------------------------------------------------------------------
create or replace function public.place_trade(
  p_market_id uuid,
  p_side      public.trade_side,
  p_cost      bigint
) returns table (
  trade_id          uuid,
  shares_received   bigint,
  reserve_yes_after bigint,
  reserve_no_after  bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_market        public.markets%rowtype;
  v_user_wallet   uuid;
  v_market_pool   uuid;
  v_balance       bigint;
  v_reserve_in    bigint;
  v_reserve_out   bigint;
  v_k             numeric;
  v_shares        bigint;
  v_new_in        bigint;
  v_new_out       bigint;
  v_tx_id         uuid;
  v_trade_id      uuid;
  v_yes_after     bigint;
  v_no_after      bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;

  -- Lock the market row (prevents concurrent reserve corruption).
  select * into v_market from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;
  if v_market.status <> 'open' then
    raise exception 'market not open (status=%)', v_market.status;
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed at %', v_market.closes_at;
  end if;

  select id into v_user_wallet
  from public.accounts
  where owner_user_id = v_user_id
    and kind = 'user_wallet'
    and currency = 'vibe';

  if v_user_wallet is null then
    raise exception 'trader wallet not found';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries
  where account_id = v_user_wallet;

  if v_balance < p_cost then
    raise exception 'insufficient balance: have %, need %', v_balance, p_cost;
  end if;

  select id into v_market_pool
  from public.accounts
  where kind = 'system_burn'
    and currency = 'vibe'
    and code = 'market_pool:' || p_market_id::text;

  if v_market_pool is null then
    raise exception 'market pool account missing';
  end if;

  -- CPMM math (mirror in src/lib/cpmm.ts).
  if p_side = 'yes' then
    v_reserve_in  := v_market.reserve_yes;
    v_reserve_out := v_market.reserve_no;
  else
    v_reserve_in  := v_market.reserve_no;
    v_reserve_out := v_market.reserve_yes;
  end if;

  v_k      := v_reserve_in::numeric * v_reserve_out::numeric;
  v_shares := floor(
    v_reserve_in + p_cost - v_k / (v_reserve_out + p_cost)
  )::bigint;

  if v_shares <= 0 then
    raise exception 'computed shares non-positive (cost too small for this pool)';
  end if;

  v_new_in  := v_reserve_in + p_cost - v_shares;
  v_new_out := v_reserve_out + p_cost;

  if p_side = 'yes' then
    v_yes_after := v_new_in;
    v_no_after  := v_new_out;
  else
    v_yes_after := v_new_out;
    v_no_after  := v_new_in;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_trade',
    'market_trade:' || gen_random_uuid()::text,
    jsonb_build_object(
      'market_id', p_market_id,
      'side', p_side,
      'cost', p_cost,
      'shares', v_shares
    ),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_cost, 'vibe'),
    (v_tx_id, v_market_pool, p_cost,  'vibe');

  update public.markets
  set reserve_yes = v_yes_after,
      reserve_no  = v_no_after
  where id = p_market_id;

  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id
  ) values (
    p_market_id, v_user_id, p_side, p_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id
  )
  returning id into v_trade_id;

  insert into public.positions (
    market_id, user_id, yes_shares, no_shares, total_cost
  ) values (
    p_market_id, v_user_id,
    case when p_side = 'yes' then v_shares else 0 end,
    case when p_side = 'no'  then v_shares else 0 end,
    p_cost
  )
  on conflict (market_id, user_id) do update set
    yes_shares = public.positions.yes_shares + case when p_side = 'yes' then v_shares else 0 end,
    no_shares  = public.positions.no_shares  + case when p_side = 'no'  then v_shares else 0 end,
    total_cost = public.positions.total_cost + p_cost,
    updated_at = now();

  return query select v_trade_id, v_shares, v_yes_after, v_no_after;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: resolve_market
--   Admin only. Pays out winners, burns residual, marks resolved.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_market(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller        uuid := auth.uid();
  v_is_admin      boolean;
  v_market        public.markets%rowtype;
  v_market_pool   uuid;
  v_burn_account  uuid;
  v_tx_id         uuid;
  v_position      record;
  v_user_wallet   uuid;
  v_payout        bigint;
  v_pool_balance  bigint;
begin
  -- Admin gate. We could also rely on a GRANT, but this gives a clean error.
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  into v_is_admin;
  if not v_is_admin then
    raise exception 'admin only';
  end if;

  select * into v_market from public.markets
  where id = p_market_id
  for update;

  if not found then raise exception 'market not found'; end if;
  if v_market.status = 'resolved' then raise exception 'market already resolved'; end if;
  if v_market.status = 'voided'  then raise exception 'market is voided'; end if;

  select id into v_market_pool
  from public.accounts
  where kind = 'system_burn'
    and currency = 'vibe'
    and code = 'market_pool:' || p_market_id::text;

  if v_market_pool is null then
    raise exception 'market pool account missing';
  end if;

  -- One ledger transaction per resolution. Entries: per-winner credit (+),
  -- market-pool debit (-) for each winner, plus a final residual burn.
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_resolve',
    'market_resolve:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id, 'outcome', p_outcome),
    v_caller
  )
  returning id into v_tx_id;

  for v_position in
    select user_id, yes_shares, no_shares from public.positions
    where market_id = p_market_id
      and (
        (p_outcome     and yes_shares > 0)
        or
        (not p_outcome and no_shares  > 0)
      )
  loop
    v_payout := case when p_outcome then v_position.yes_shares else v_position.no_shares end;

    select id into v_user_wallet
    from public.accounts
    where owner_user_id = v_position.user_id
      and kind = 'user_wallet'
      and currency = 'vibe';

    if v_user_wallet is null then
      raise exception 'wallet missing for user %', v_position.user_id;
    end if;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet, v_payout,  'vibe'),
      (v_tx_id, v_market_pool, -v_payout, 'vibe');

    update public.positions
    set total_payout = total_payout + v_payout
    where market_id = p_market_id
      and user_id = v_position.user_id;
  end loop;

  -- Burn any residual VIBE left in the market pool.
  select coalesce(sum(amount), 0) into v_pool_balance
  from public.ledger_entries
  where account_id = v_market_pool;

  if v_pool_balance > 0 then
    select id into v_burn_account
    from public.accounts
    where kind = 'system_burn'
      and currency = 'vibe'
      and code = 'market_residual_burn';

    if v_burn_account is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'market_residual_burn')
      returning id into v_burn_account;
    end if;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_market_pool, -v_pool_balance, 'vibe'),
      (v_tx_id, v_burn_account, v_pool_balance, 'vibe');
  end if;

  update public.markets set
    status = 'resolved',
    resolved_outcome = p_outcome,
    resolved_at = now()
  where id = p_market_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.create_market(text, text, bigint, timestamptz) from public;
revoke execute on function public.place_trade(uuid, public.trade_side, bigint)    from public;
revoke execute on function public.resolve_market(uuid, boolean)                   from public;

grant execute on function public.create_market(text, text, bigint, timestamptz) to authenticated;
grant execute on function public.place_trade(uuid, public.trade_side, bigint)    to authenticated;
grant execute on function public.resolve_market(uuid, boolean)                   to authenticated;
-- Note: resolve_market enforces admin via auth.jwt() inside the function body.

-- -----------------------------------------------------------------------------
-- Flip the markets_enabled flag on by default in DEV so the UI is visible.
-- Production deployments should toggle this off until they're ready.
-- -----------------------------------------------------------------------------
update public.feature_flags set enabled = true where key = 'markets_enabled';
