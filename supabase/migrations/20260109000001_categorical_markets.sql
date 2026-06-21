-- =============================================================================
-- Phase 4 (part 2 of 2): Multi-outcome (categorical) markets
-- =============================================================================
-- Two market kinds coexist from here on:
--
--   binary       — uses constant-product CPMM on (reserve_yes, reserve_no).
--                  Created by `create_market`, traded via `place_trade`,
--                  resolved via `propose_resolution`/`finalize_market_internal`.
--                  Existing code path — UNCHANGED.
--
--   categorical  — uses LMSR (Logarithmic Market Scoring Rule) on N outcomes.
--                  Created by `create_categorical_market`, traded via
--                  `place_categorical_trade`, resolved via
--                  `propose_resolution_categorical`/`finalize_categorical_internal`.
--                  NEW.
--
-- LMSR is Hanson's standard for prediction markets with 3+ outcomes. Cost
-- function:    C(q) = b * ln( sum_i exp(q_i / b) )
-- Prices:      p_i  = exp(q_i/b) / sum_j exp(q_j/b)         (always sum to 1)
-- Liquidity:   b is set so the AMM's maximum loss is exactly the subsidy.
--              b = subsidy / ln(N).
--
-- IMPORTANT: payouts are ONE-PER-SHARE for the winning outcome. Shares of all
-- other outcomes become worthless. Total VIBE paid out can exceed `subsidy`
-- (the AMM is subsidising info aggregation — this is by design and is the
-- difference between LMSR and a self-balancing CPMM).
--
-- Resolution flow re-uses the Phase 3 two-phase model:
--   1. Admin calls `propose_resolution_categorical(market_id, outcome_index)`.
--      Market moves to `resolving`. 24h challenge window opens.
--   2. After 24h with no dispute (categorical disputes are deferred to
--      Phase 4.5 — see `open_dispute` guard below), `court_tick` calls
--      `finalize_categorical_internal` which performs the payouts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- markets gets two new columns: kind + lmsr_b. proposed_outcome_index is added
-- alongside the existing proposed_outcome (boolean) — exactly one is used per
-- market depending on its kind.
-- -----------------------------------------------------------------------------
alter table public.markets
  add column if not exists kind                    public.market_kind not null default 'binary',
  add column if not exists lmsr_b                  numeric,            -- LMSR liquidity, set on creation
  add column if not exists proposed_outcome_index  int;                -- proposed winning index (categorical)

create index if not exists markets_kind_status_idx
  on public.markets (kind, status);

-- Sanity: for new categorical markets, lmsr_b must be > 0.
alter table public.markets
  drop constraint if exists markets_lmsr_b_positive_for_categorical;
alter table public.markets
  add constraint markets_lmsr_b_positive_for_categorical
  check (kind = 'binary' or (lmsr_b is not null and lmsr_b > 0));

-- -----------------------------------------------------------------------------
-- market_outcomes
--   N rows per categorical market. For binary markets, this table stays empty
--   (we already have outcome_yes_label / outcome_no_label columns on markets).
--
--   `shares` is the cumulative shares the AMM has sold to users on this
--   outcome. It increases monotonically as users buy and stays at the post-
--   trade value (no sells in Phase 4 v1 — see deferred section in PLAYBOOK).
-- -----------------------------------------------------------------------------
create table public.market_outcomes (
  market_id      uuid not null references public.markets(id) on delete cascade,
  outcome_index  int  not null check (outcome_index >= 0 and outcome_index < 32),
  label          text not null check (length(label) between 1 and 80),
  image_url      text,
  shares         bigint not null default 0 check (shares >= 0),
  created_at     timestamptz not null default now(),
  primary key (market_id, outcome_index)
);

alter table public.market_outcomes enable row level security;

create policy market_outcomes_select_all on public.market_outcomes
  for select to authenticated, anon using (true);

-- No INSERT/UPDATE policy: writes via SECURITY DEFINER RPCs only.

-- -----------------------------------------------------------------------------
-- categorical_positions
--   Per-user shares per outcome. Mirrors the structure of `positions` for
--   binary markets but indexed by outcome_index.
-- -----------------------------------------------------------------------------
create table public.categorical_positions (
  market_id      uuid not null references public.markets(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  outcome_index  int  not null,
  shares         bigint not null default 0 check (shares >= 0),
  total_cost     bigint not null default 0 check (total_cost >= 0),
  total_payout   bigint not null default 0 check (total_payout >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (market_id, user_id, outcome_index),
  foreign key (market_id, outcome_index)
    references public.market_outcomes (market_id, outcome_index)
    on delete cascade
);

create index categorical_positions_user_idx
  on public.categorical_positions (user_id, market_id);

alter table public.categorical_positions enable row level security;

create policy categorical_positions_select_own on public.categorical_positions
  for select to authenticated using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- trades extension: add nullable outcome_index for categorical trades.
-- For binary trades it stays null (use `side` instead).
-- -----------------------------------------------------------------------------
alter table public.trades
  add column if not exists outcome_index int;

-- side is currently NOT NULL. Make it nullable so categorical trades can
-- store outcome_index without setting side.
alter table public.trades alter column side drop not null;

-- Constraint: a trade row has EXACTLY ONE of (side, outcome_index) set.
alter table public.trades
  drop constraint if exists trades_side_xor_outcome_index;
alter table public.trades
  add constraint trades_side_xor_outcome_index
  check (
    (side is not null and outcome_index is null) or
    (side is null and outcome_index is not null)
  );

-- =============================================================================
-- LMSR math helpers
--   All numeric. We use log-sum-exp for numerical stability — naive
--   sum(exp(q_i/b)) overflows for q_i/b > ~700.
-- =============================================================================

-- Numerically stable log(sum(exp(xs[i]))). Returns NULL for empty input.
create or replace function public.log_sum_exp(p_xs numeric[])
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_max numeric;
  v_sum numeric := 0;
  v_x   numeric;
begin
  if p_xs is null or array_length(p_xs, 1) is null then
    return null;
  end if;
  select max(x) into v_max from unnest(p_xs) as t(x);
  -- Shift by max for numerical stability; only meaningful when v_max is huge.
  for v_x in select unnest(p_xs) loop
    v_sum := v_sum + exp(v_x - v_max);
  end loop;
  return v_max + ln(v_sum);
end;
$$;

-- LMSR price of each outcome given shares-sold vector q and liquidity b.
-- Returns numeric[] of probabilities (sum = 1).
create or replace function public.lmsr_prices(p_q bigint[], p_b numeric)
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_xs       numeric[];
  v_log_sum  numeric;
  v_out      numeric[] := '{}';
  v_x        numeric;
begin
  if p_q is null or array_length(p_q, 1) is null then
    return null;
  end if;
  select array_agg((x::numeric) / p_b) into v_xs from unnest(p_q) as t(x);
  v_log_sum := public.log_sum_exp(v_xs);
  for v_x in select unnest(v_xs) loop
    v_out := array_append(v_out, exp(v_x - v_log_sum));
  end loop;
  return v_out;
end;
$$;

-- LMSR closed-form: how many shares of outcome i (0-indexed) do you get for
-- exactly p_cost VIBE? Returns 0 if p_cost <= 0.
--
-- Derivation:
--   Let s_j = exp(q_j / b),  S = sum_j s_j,  S_-i = S - s_i.
--   After buying delta shares on outcome i:
--     s_i' = s_i * exp(delta / b)
--     S'   = S_-i + s_i'
--   Cost paid: C(q') - C(q) = b * ln(S' / S)
--   Setting cost = b * ln(S' / S):
--     S' = S * exp(cost / b)
--     s_i' = S * exp(cost / b) - S_-i
--     delta = b * ln(s_i' / s_i) = b * ln((S * exp(cost/b) - S_-i) / s_i)
--
-- Done in log-space throughout to avoid overflow.
create or replace function public.lmsr_shares_for_cost(
  p_q             bigint[],
  p_b             numeric,
  p_outcome_index int,
  p_cost          bigint
) returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n              int;
  v_xs             numeric[];
  v_log_S          numeric;
  v_log_S_minus_i  numeric;
  v_xs_minus_i     numeric[];
  v_x_i            numeric;
  v_log_numerator  numeric;
  v_delta          numeric;
  v_a_minus_b      numeric;
  v_idx            int;
begin
  if p_cost is null or p_cost <= 0 then return 0; end if;
  v_n := array_length(p_q, 1);
  if v_n is null or v_n < 2 then
    raise exception 'invalid q array';
  end if;
  if p_outcome_index < 0 or p_outcome_index >= v_n then
    raise exception 'outcome_index out of range';
  end if;

  -- Build xs = q_j / b
  select array_agg((x::numeric) / p_b)
    into v_xs
    from unnest(p_q) with ordinality as t(x, ord)
    order by ord;

  v_log_S := public.log_sum_exp(v_xs);
  v_x_i   := v_xs[p_outcome_index + 1];  -- v_xs is 1-indexed in pg

  -- xs without index i — pg arrays don't have splice; rebuild manually.
  v_xs_minus_i := '{}';
  v_idx := 0;
  while v_idx < v_n loop
    if v_idx <> p_outcome_index then
      v_xs_minus_i := array_append(v_xs_minus_i, v_xs[v_idx + 1]);
    end if;
    v_idx := v_idx + 1;
  end loop;

  v_log_S_minus_i := public.log_sum_exp(v_xs_minus_i);

  -- log_numerator = log(exp(log_S + cost/b) - exp(log_S_minus_i))
  --               = log_S_minus_i + log(exp(log_S + cost/b - log_S_minus_i) - 1)
  v_a_minus_b := (v_log_S + (p_cost::numeric / p_b)) - v_log_S_minus_i;
  if v_a_minus_b <= 0 then
    -- Should never happen (S > S_-i and cost > 0). Defensive.
    return 0;
  end if;
  v_log_numerator := v_log_S_minus_i + ln(exp(v_a_minus_b) - 1);

  -- delta = b * (log_numerator - x_i)
  v_delta := p_b * (v_log_numerator - v_x_i);

  if v_delta <= 0 then return 0; end if;
  -- Round down to integer shares. Floor so the AMM never gives more value
  -- than the user paid for.
  return floor(v_delta)::bigint;
end;
$$;

-- =============================================================================
-- RPC: create_categorical_market
--   N outcomes, 2 <= N <= 8. Subsidy goes into a per-market burn pool
--   (LMSR's max loss). Liquidity b = subsidy / ln(N).
-- =============================================================================
create or replace function public.create_categorical_market(
  p_question       text,
  p_description    text,
  p_outcome_labels text[],
  p_subsidy        bigint,
  p_closes_at      timestamptz,
  p_category       public.market_category,
  p_image_url      text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_market_id   uuid;
  v_n           int;
  v_b           numeric;
  v_wallet      uuid;
  v_balance     bigint;
  v_pool        uuid;
  v_tx_id       uuid;
  v_label       text;
  v_idx         int := 0;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_n := coalesce(array_length(p_outcome_labels, 1), 0);
  if v_n < 2 or v_n > 8 then
    raise exception 'categorical markets need 2 to 8 outcomes (got %)', v_n;
  end if;
  if p_subsidy < 100 or p_subsidy > 100000 then
    raise exception 'subsidy must be between 100 and 100,000 VIBE';
  end if;
  if length(coalesce(trim(p_question), '')) < 8 then
    raise exception 'question too short';
  end if;

  -- Validate labels: unique, non-empty, max 80 chars.
  if exists (
    select 1 from unnest(p_outcome_labels) as l
    where length(trim(coalesce(l, ''))) = 0 or length(l) > 80
  ) then
    raise exception 'outcome labels must be 1-80 chars';
  end if;
  if (select count(distinct lower(trim(l))) from unnest(p_outcome_labels) as l) <> v_n then
    raise exception 'outcome labels must be distinct';
  end if;

  -- Liquidity b such that max loss = subsidy. Max loss for LMSR = b * ln(N).
  v_b := p_subsidy::numeric / ln(v_n::numeric);

  -- Debit subsidy from creator's wallet → market pool.
  select id into v_wallet
    from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_subsidy then
    raise exception 'insufficient VIBE: need %, have %', p_subsidy, v_balance;
  end if;

  -- Create market row
  insert into public.markets (
    creator_id, question, description, status,
    reserve_yes, reserve_no, subsidy,
    closes_at, category, image_url, is_featured,
    outcome_yes_label, outcome_no_label,
    kind, lmsr_b
  )
  values (
    v_user_id, p_question, nullif(trim(p_description), ''), 'open',
    0, 0,                  -- reserve_yes / reserve_no unused for categorical
    p_subsidy,
    p_closes_at, p_category, p_image_url, false,
    'Yes', 'No',           -- unused for categorical but column is NOT NULL
    'categorical', v_b
  )
  returning id into v_market_id;

  -- Per-market burn pool (mirrors binary `market_pool:` convention)
  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'market_pool:' || v_market_id::text)
  returning id into v_pool;

  -- Outcome rows
  foreach v_label in array p_outcome_labels loop
    insert into public.market_outcomes (market_id, outcome_index, label)
    values (v_market_id, v_idx, trim(v_label));
    v_idx := v_idx + 1;
  end loop;

  -- Ledger: creator → pool
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_subsidy',
    'market_subsidy:' || v_market_id::text,
    jsonb_build_object('market_id', v_market_id, 'kind', 'categorical', 'n_outcomes', v_n),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_subsidy, 'vibe'),
    (v_tx_id, v_pool,    p_subsidy, 'vibe');

  return v_market_id;
end;
$$;

revoke execute on function public.create_categorical_market(text, text, text[], bigint, timestamptz, public.market_category, text) from public;
grant  execute on function public.create_categorical_market(text, text, text[], bigint, timestamptz, public.market_category, text) to authenticated;

-- =============================================================================
-- RPC: place_categorical_trade
--   Buys LMSR shares on outcome_index for exactly p_cost VIBE.
--   Updates: ledger (user → pool), market_outcomes.shares, positions row.
--   Also records a row in `trades` for chart / activity history.
-- =============================================================================
create or replace function public.place_categorical_trade(
  p_market_id      uuid,
  p_outcome_index  int,
  p_cost           bigint
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_market      public.markets%rowtype;
  v_n           int;
  v_q           bigint[];
  v_shares      bigint;
  v_wallet      uuid;
  v_balance     bigint;
  v_pool        uuid;
  v_tx_id       uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_cost is null or p_cost < 10 then
    raise exception 'minimum trade size is 10 VIBE';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.kind <> 'categorical' then
    raise exception 'use place_trade for binary markets';
  end if;
  if v_market.status <> 'open' then
    raise exception 'market is %, cannot trade', v_market.status;
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market is closed';
  end if;

  -- Lock outcome rows and load q[] in order.
  select count(*)::int, array_agg(shares order by outcome_index)
    into v_n, v_q
    from public.market_outcomes
    where market_id = p_market_id
    for update;

  if p_outcome_index < 0 or p_outcome_index >= v_n then
    raise exception 'invalid outcome_index';
  end if;

  v_shares := public.lmsr_shares_for_cost(v_q, v_market.lmsr_b, p_outcome_index, p_cost);
  if v_shares <= 0 then
    raise exception 'trade would yield 0 shares — increase cost';
  end if;

  -- Debit user, credit market pool
  select id into v_wallet
    from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_cost then
    raise exception 'insufficient VIBE: need %, have %', p_cost, v_balance;
  end if;

  select id into v_pool
    from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_pool is null then raise exception 'market pool missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'categorical_buy',
    null,
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome_index', p_outcome_index,
      'shares', v_shares,
      'cost', p_cost
    ),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_cost, 'vibe'),
    (v_tx_id, v_pool,    p_cost, 'vibe');

  -- Update outcome's cumulative shares
  update public.market_outcomes
     set shares = shares + v_shares
   where market_id = p_market_id and outcome_index = p_outcome_index;

  -- Upsert user's position on this outcome
  insert into public.categorical_positions
    (market_id, user_id, outcome_index, shares, total_cost)
  values (p_market_id, v_user_id, p_outcome_index, v_shares, p_cost)
  on conflict (market_id, user_id, outcome_index) do update
    set shares     = public.categorical_positions.shares + excluded.shares,
        total_cost = public.categorical_positions.total_cost + excluded.total_cost,
        updated_at = now();

  -- Record trade for history / future chart
  insert into public.trades
    (market_id, user_id, side, outcome_index, shares, cost,
     reserve_yes_after, reserve_no_after)
  values
    (p_market_id, v_user_id, null, p_outcome_index, v_shares, p_cost, 0, 0);

  return v_shares;
end;
$$;

revoke execute on function public.place_categorical_trade(uuid, int, bigint) from public;
grant  execute on function public.place_categorical_trade(uuid, int, bigint) to authenticated;

-- =============================================================================
-- RPC: propose_resolution_categorical
--   Admin proposes a winning outcome. Market moves to `resolving`.
-- =============================================================================
create or replace function public.propose_resolution_categorical(
  p_market_id     uuid,
  p_outcome_index int
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin  boolean;
  v_market    public.markets%rowtype;
  v_n         int;
  v_label     text;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.kind <> 'categorical' then
    raise exception 'use propose_resolution for binary markets';
  end if;
  if v_market.status not in ('open', 'closed') then
    raise exception 'market is %, cannot propose', v_market.status;
  end if;

  select count(*)::int into v_n from public.market_outcomes where market_id = p_market_id;
  if p_outcome_index < 0 or p_outcome_index >= v_n then
    raise exception 'invalid outcome_index';
  end if;

  select label into v_label
    from public.market_outcomes
   where market_id = p_market_id and outcome_index = p_outcome_index;

  update public.markets
     set status                  = 'resolving',
         proposed_outcome_index  = p_outcome_index,
         challenge_deadline      = now() + interval '24 hours'
   where id = p_market_id;

  insert into public.event_queue (event_type, payload) values (
    'categorical_resolution_proposed',
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome_index', p_outcome_index,
      'outcome_label', v_label,
      'question', v_market.question,
      'challenge_deadline', (now() + interval '24 hours')::text
    )
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.propose_resolution_categorical(uuid, int) from public;
grant  execute on function public.propose_resolution_categorical(uuid, int) to authenticated;

-- =============================================================================
-- Internal: finalize_categorical_internal(market_id, outcome_index)
--   Pays out 1 VIBE per share for the winning outcome. Burns the rest of
--   the pool. Idempotent (returns early if already resolved).
-- =============================================================================
create or replace function public.finalize_categorical_internal(
  p_market_id     uuid,
  p_outcome_index int
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market         public.markets%rowtype;
  v_pool           uuid;
  v_burn           uuid;
  v_tx_id          uuid;
  v_position       record;
  v_user_wallet    uuid;
  v_payout         bigint;
  v_pool_balance   bigint;
  v_winner_label   text;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.kind <> 'categorical' then
    raise exception 'use finalize_market_internal for binary markets';
  end if;
  if v_market.status = 'resolved' then return; end if;  -- idempotent
  if v_market.status = 'voided'   then return; end if;

  select id into v_pool from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_pool is null then raise exception 'market pool missing'; end if;

  select label into v_winner_label
    from public.market_outcomes
   where market_id = p_market_id and outcome_index = p_outcome_index;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'categorical_resolve',
    'categorical_resolve:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id, 'outcome_index', p_outcome_index),
    null
  )
  returning id into v_tx_id;

  -- Pay each holder of the winning outcome: 1 VIBE per share.
  for v_position in
    select user_id, shares from public.categorical_positions
     where market_id = p_market_id
       and outcome_index = p_outcome_index
       and shares > 0
  loop
    v_payout := v_position.shares;
    select id into v_user_wallet
      from public.accounts
     where owner_user_id = v_position.user_id
       and kind = 'user_wallet' and currency = 'vibe';
    if v_user_wallet is null then
      raise exception 'wallet missing for user %', v_position.user_id;
    end if;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet,  v_payout, 'vibe'),
      (v_tx_id, v_pool,        -v_payout, 'vibe');

    update public.categorical_positions
       set total_payout = total_payout + v_payout,
           updated_at = now()
     where market_id = p_market_id
       and user_id = v_position.user_id
       and outcome_index = p_outcome_index;
  end loop;

  -- Burn residual pool balance (LMSR can have positive OR negative residue;
  -- if total payouts exceed subsidy, this would be negative meaning the
  -- platform absorbed a loss. We still drain to 0.).
  select coalesce(sum(amount), 0) into v_pool_balance
    from public.ledger_entries where account_id = v_pool;

  if v_pool_balance > 0 then
    select id into v_burn
      from public.accounts
     where kind = 'system_burn' and currency = 'vibe' and code = 'market_residual_burn';
    if v_burn is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'market_residual_burn')
      returning id into v_burn;
    end if;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_pool, -v_pool_balance, 'vibe'),
      (v_tx_id, v_burn,  v_pool_balance, 'vibe');
  elsif v_pool_balance < 0 then
    -- Pool went negative — the AMM lost money (LMSR can do this in extreme
    -- cases). Mint the difference from the system mint to balance the ledger.
    declare
      v_mint uuid;
      v_deficit bigint := -v_pool_balance;
    begin
      select id into v_mint from public.accounts
       where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
      if v_mint is null then
        insert into public.accounts (kind, currency, code)
        values ('system_mint', 'vibe', 'vibe_mint')
        returning id into v_mint;
      end if;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_pool,  v_deficit, 'vibe'),
        (v_tx_id, v_mint, -v_deficit, 'vibe');
    end;
  end if;

  update public.markets
     set status            = 'resolved',
         resolved_outcome  = null,  -- not meaningful for categorical
         resolved_at       = now()
   where id = p_market_id;

  insert into public.event_queue (event_type, payload) values (
    'categorical_market_resolved',
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome_index', p_outcome_index,
      'outcome_label', v_winner_label,
      'question', v_market.question
    )
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.finalize_categorical_internal(uuid, int) from public;

-- =============================================================================
-- Patch court_tick to handle categorical markets too.
--   When a `resolving` market's challenge_deadline passes:
--     - binary    → finalize_market_internal(market_id, proposed_outcome)
--     - categorical → finalize_categorical_internal(market_id, proposed_outcome_index)
--
-- The disputes flow (for binary only in Phase 4 v1) is unchanged.
-- =============================================================================
create or replace function public.court_tick(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market   record;
  v_dispute  record;
  v_count    int := 0;
begin
  -- 1) Auto-finalize resolving markets past challenge window
  for v_market in
    select id, kind, proposed_outcome, proposed_outcome_index
      from public.markets
     where status = 'resolving'
       and challenge_deadline is not null
       and challenge_deadline < now()
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  loop
    begin
      if v_market.kind = 'categorical' then
        if v_market.proposed_outcome_index is not null then
          perform public.finalize_categorical_internal(
            v_market.id, v_market.proposed_outcome_index
          );
          v_count := v_count + 1;
        end if;
      else
        if v_market.proposed_outcome is not null then
          perform public.finalize_market_internal(v_market.id, v_market.proposed_outcome);
          v_count := v_count + 1;
        end if;
      end if;
    exception when others then
      null;  -- swallow per-row; tick should not abort
    end;
  end loop;

  -- 2) Auto-resolve disputes past voting window (binary only — categorical
  -- disputes are deferred to Phase 4.5).
  for v_dispute in
    select id from public.disputes
     where status = 'voting'
       and voting_ends_at < now()
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  loop
    begin
      perform public.resolve_dispute_internal(v_dispute.id);
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$$;

-- =============================================================================
-- Patch open_dispute to reject disputes on categorical markets (Phase 4 v1).
-- =============================================================================
create or replace function public.open_dispute(
  p_market_id uuid,
  p_reasoning text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_market         public.markets%rowtype;
  v_position       public.positions%rowtype;
  v_volume         bigint;
  v_stake          bigint;
  v_balance        bigint;
  v_user_wallet    uuid;
  v_escrow         uuid;
  v_dispute_id     uuid;
  v_tx_id          uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_market from public.markets
   where id = p_market_id
   for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.kind = 'categorical' then
    raise exception 'disputes on categorical markets are coming in Phase 4.5';
  end if;
  if v_market.status <> 'resolving' then
    raise exception 'market is %, cannot dispute', v_market.status;
  end if;
  if v_market.challenge_deadline is null or v_market.challenge_deadline < now() then
    raise exception 'challenge window has closed';
  end if;
  if v_market.creator_id = v_user_id then
    raise exception 'creator cannot dispute their own market';
  end if;

  select * into v_position from public.positions
   where market_id = p_market_id and user_id = v_user_id;
  if not found or (v_position.yes_shares = 0 and v_position.no_shares = 0) then
    raise exception 'must hold a position to open a dispute';
  end if;

  select coalesce(sum(abs(cost)), 0)::bigint into v_volume
    from public.trades where market_id = p_market_id;

  v_stake := greatest(100, (v_volume / 20)::bigint);
  if v_stake > 10000 then v_stake := 10000; end if;

  select id into v_user_wallet
    from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < v_stake then
    raise exception 'insufficient stake: need % VIBE, have %', v_stake, v_balance;
  end if;

  insert into public.disputes
    (market_id, initiator_id, claimed_outcome, proposed_outcome,
     stake_amount, reasoning, voting_ends_at)
  values (
    p_market_id, v_user_id,
    not coalesce(v_market.proposed_outcome, false),
    coalesce(v_market.proposed_outcome, false),
    v_stake,
    nullif(trim(p_reasoning), ''),
    now() + interval '48 hours'
  )
  returning id into v_dispute_id;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'dispute_escrow:' || v_dispute_id::text)
  returning id into v_escrow;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'dispute_open',
    'dispute_open:' || v_dispute_id::text,
    jsonb_build_object('dispute_id', v_dispute_id, 'market_id', p_market_id),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -v_stake, 'vibe'),
    (v_tx_id, v_escrow,       v_stake, 'vibe');

  update public.markets
     set status         = 'in_court',
         voting_ends_at = now() + interval '48 hours'
   where id = p_market_id;

  insert into public.event_queue (event_type, payload) values (
    'dispute_opened',
    jsonb_build_object(
      'dispute_id', v_dispute_id,
      'market_id',  p_market_id,
      'question',   v_market.question,
      'stake',      v_stake
    )
  );
  perform public.process_event_queue(200);

  return v_dispute_id;
end;
$$;

-- =============================================================================
-- Extend process_event_queue to handle categorical events.
-- (Binary handlers remain unchanged from migration 8.)
-- =============================================================================
create or replace function public.process_event_queue(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event     record;
  v_processed int := 0;
  v_payload   jsonb;
  v_market_id uuid;
  v_outcome   boolean;
  v_question  text;
  v_yes_lbl   text;
  v_no_lbl    text;
  v_outcome_label text;
begin
  for v_event in
    select * from public.event_queue
     where status = 'pending'
     order by created_at asc
     limit greatest(1, least(p_limit, 500))
     for update skip locked
  loop
    begin
      v_payload := v_event.payload;

      if v_event.event_type = 'market_resolved' then
        v_market_id := (v_payload->>'market_id')::uuid;
        v_outcome   := (v_payload->>'outcome')::boolean;
        v_question  := coalesce(v_payload->>'question', 'a market');
        v_yes_lbl   := coalesce(v_payload->>'yes_label', 'Yes');
        v_no_lbl    := coalesce(v_payload->>'no_label', 'No');
        v_outcome_label := case when v_outcome then v_yes_lbl else v_no_lbl end;

        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select
          p.user_id,
          case
            when v_outcome     and p.yes_shares > 0 then 'bet_won'::public.notification_kind
            when not v_outcome and p.no_shares  > 0 then 'bet_won'::public.notification_kind
            else 'bet_lost'::public.notification_kind
          end,
          case
            when (v_outcome and p.yes_shares > 0) or (not v_outcome and p.no_shares > 0)
              then 'You won: ' || v_question
            else 'Resolved against you: ' || v_question
          end,
          'Outcome: ' || v_outcome_label,
          jsonb_build_object('market_id', v_market_id, 'outcome', v_outcome),
          'market_resolved:' || v_market_id::text
        from public.positions p
        where p.market_id = v_market_id
          and (p.yes_shares > 0 or p.no_shares > 0)
        on conflict (user_id, dedupe_key) do nothing;

      elsif v_event.event_type = 'market_commented' then
        if (v_payload->>'market_creator_id') is not null
           and (v_payload->>'commenter_id') is not null
           and (v_payload->>'market_creator_id') <> (v_payload->>'commenter_id')
        then
          insert into public.notifications
            (user_id, kind, title, body, data, dedupe_key)
          values (
            (v_payload->>'market_creator_id')::uuid,
            'market_commented',
            'New comment on your market',
            left(coalesce(v_payload->>'body', ''), 160),
            jsonb_build_object(
              'market_id', v_payload->>'market_id',
              'comment_id', v_payload->>'comment_id'
            ),
            'market_commented:' || (v_payload->>'comment_id')
          )
          on conflict (user_id, dedupe_key) do nothing;
        end if;

      elsif v_event.event_type = 'resolution_proposed' then
        v_market_id := (v_payload->>'market_id')::uuid;
        v_outcome   := (v_payload->>'outcome')::boolean;
        v_yes_lbl   := coalesce(v_payload->>'yes_label', 'Yes');
        v_no_lbl    := coalesce(v_payload->>'no_label', 'No');
        v_outcome_label := case when v_outcome then v_yes_lbl else v_no_lbl end;

        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select
          p.user_id,
          'resolution_proposed',
          'Resolution proposed: ' || v_outcome_label,
          coalesce(v_payload->>'question', 'a market') || ' — 24h to dispute.',
          jsonb_build_object('market_id', v_market_id, 'outcome', v_outcome),
          'resolution_proposed:' || v_market_id::text
        from public.positions p
        where p.market_id = v_market_id
          and (p.yes_shares > 0 or p.no_shares > 0)
        on conflict (user_id, dedupe_key) do nothing;

      elsif v_event.event_type = 'dispute_opened' then
        v_market_id := (v_payload->>'market_id')::uuid;
        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select
          p.user_id,
          'dispute_opened',
          'Dispute opened',
          coalesce(v_payload->>'question', 'a market') || ' — community now voting.',
          jsonb_build_object(
            'market_id', v_market_id,
            'dispute_id', v_payload->>'dispute_id'
          ),
          'dispute_opened:' || (v_payload->>'dispute_id')
        from public.positions p
        where p.market_id = v_market_id
          and (p.yes_shares > 0 or p.no_shares > 0)
        on conflict (user_id, dedupe_key) do nothing;

      elsif v_event.event_type = 'dispute_resolved' then
        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        values (
          (v_payload->>'initiator_id')::uuid,
          'dispute_resolved',
          case (v_payload->>'status')
            when 'overturned' then 'Court agreed with you'
            when 'upheld'     then 'Court upheld the original outcome'
            when 'expired'    then 'Voting closed with no votes — original outcome stands'
            else 'Dispute closed'
          end,
          case when (v_payload->>'stake_refunded')::boolean
            then 'Stake refunded.'
            else 'Stake forfeited.'
          end,
          jsonb_build_object(
            'market_id', v_payload->>'market_id',
            'dispute_id', v_payload->>'dispute_id'
          ),
          'dispute_resolved:initiator:' || (v_payload->>'dispute_id')
        )
        on conflict (user_id, dedupe_key) do nothing;

      -- ===== Categorical events =====
      elsif v_event.event_type = 'categorical_resolution_proposed' then
        v_market_id := (v_payload->>'market_id')::uuid;
        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select distinct
          cp.user_id,
          'resolution_proposed',
          'Resolution proposed: ' || coalesce(v_payload->>'outcome_label', '?'),
          coalesce(v_payload->>'question', 'a market') || ' — 24h to dispute (binary holders only in v1).',
          jsonb_build_object(
            'market_id', v_market_id,
            'outcome_index', (v_payload->>'outcome_index')::int
          ),
          'resolution_proposed:' || v_market_id::text
        from public.categorical_positions cp
        where cp.market_id = v_market_id
          and cp.shares > 0
        on conflict (user_id, dedupe_key) do nothing;

      elsif v_event.event_type = 'categorical_market_resolved' then
        v_market_id := (v_payload->>'market_id')::uuid;
        v_question  := coalesce(v_payload->>'question', 'a market');
        v_outcome_label := coalesce(v_payload->>'outcome_label', '?');

        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select distinct
          cp.user_id,
          case when cp.outcome_index = (v_payload->>'outcome_index')::int
            then 'bet_won'::public.notification_kind
            else 'bet_lost'::public.notification_kind
          end,
          case when cp.outcome_index = (v_payload->>'outcome_index')::int
            then 'You won: ' || v_question
            else 'Resolved against you: ' || v_question
          end,
          'Outcome: ' || v_outcome_label,
          jsonb_build_object('market_id', v_market_id, 'outcome_label', v_outcome_label),
          'market_resolved:' || v_market_id::text
        from public.categorical_positions cp
        where cp.market_id = v_market_id
          and cp.shares > 0
        on conflict (user_id, dedupe_key) do nothing;
      end if;

      update public.event_queue
         set status = 'completed', processed_at = now()
       where id = v_event.id;
      v_processed := v_processed + 1;

    exception when others then
      update public.event_queue
         set status = 'failed', attempts = attempts + 1,
             error_message = sqlerrm, processed_at = now()
       where id = v_event.id;
    end;
  end loop;
  return v_processed;
end;
$$;

-- =============================================================================
-- Rebuild markets_view to expose the new columns (kind, lmsr_b,
-- proposed_outcome_index).  Same content as before, plus the new fields.
-- =============================================================================
drop view if exists public.markets_view;
create view public.markets_view
with (security_invoker = true) as
select
  m.*,
  (m.reserve_no::numeric / nullif(m.reserve_yes + m.reserve_no, 0))::numeric
    as yes_price,
  coalesce((
    select (t.reserve_no_after::numeric
            / nullif(t.reserve_yes_after + t.reserve_no_after, 0))::numeric
    from public.trades t
    where t.market_id = m.id
      and t.side is not null
      and t.created_at < (now() - interval '24 hours')
    order by t.created_at desc
    limit 1
  ), 0.5::numeric) as yes_price_24h_ago,
  coalesce((select sum(abs(t.cost))::bigint from public.trades t where t.market_id = m.id), 0)::bigint as volume,
  coalesce((select count(*)::int from public.trades t where t.market_id = m.id), 0)::int as trade_count,
  coalesce((
    select sum(abs(t.cost))::bigint
    from public.trades t
    where t.market_id = m.id
      and t.created_at >= (now() - interval '24 hours')
  ), 0)::bigint as volume_24h
from public.markets m;

-- =============================================================================
-- categorical_market_view: convenience view joining markets + their outcomes
-- as a JSON array. Useful for fetching a market and its outcomes in one query.
-- =============================================================================
create or replace view public.categorical_market_view
with (security_invoker = true) as
select
  m.*,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'outcome_index', mo.outcome_index,
        'label', mo.label,
        'image_url', mo.image_url,
        'shares', mo.shares
      ) order by mo.outcome_index
    )
    from public.market_outcomes mo
    where mo.market_id = m.id
  ), '[]'::jsonb) as outcomes,
  coalesce((
    select sum(abs(t.cost))::bigint from public.trades t where t.market_id = m.id
  ), 0)::bigint as volume,
  coalesce((
    select count(*)::int from public.trades t where t.market_id = m.id
  ), 0)::int as trade_count
from public.markets m
where m.kind = 'categorical';
