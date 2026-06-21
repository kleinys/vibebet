-- =============================================================================
-- Phase 3: Meme Court (community-arbitrated dispute system)
-- =============================================================================
-- Resolution becomes two-phase:
--
--   open
--    └─ admin proposes outcome ──> resolving (24h challenge window)
--                                   │
--          (challenge window expires)│   ┌──── (vote ends)
--                                   ▼   ▼
--                                resolved (payouts settle)
--                                   ▲
--          (vote ends — court keeps │
--           proposed or overturns it)
--                                   │
--                                in_court (48h voting window)
--                                   ▲
--          (eligible user opens     │
--           dispute, stakes VIBE)   │
--                                   resolving
--
-- Payouts are NEVER reversed. They happen exactly once, at finalization, after
-- both the challenge window and any vote have expired. This avoids "user
-- already spent the winnings on Gems via Stripe" — that money is real and
-- can't be clawed back.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Status enum extensions live in 20260108000000_meme_court_enums.sql so they
-- commit before this script runs (Postgres won't let us reference a brand-new
-- enum value in the same transaction it was added — error 55P04).
-- This file expects 'resolving' and 'in_court' to already exist on
-- public.market_status.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Markets get three new columns for two-phase resolution.
-- -----------------------------------------------------------------------------
alter table public.markets
  add column if not exists proposed_outcome    boolean,
  add column if not exists challenge_deadline  timestamptz,
  add column if not exists voting_ends_at      timestamptz;

create index if not exists markets_resolving_idx
  on public.markets (challenge_deadline)
  where status = 'resolving';

create index if not exists markets_in_court_idx
  on public.markets (voting_ends_at)
  where status = 'in_court';

-- -----------------------------------------------------------------------------
-- markets_view: rebuild so the new columns (proposed_outcome,
-- challenge_deadline, voting_ends_at) are exposed alongside the existing
-- 24h-stats columns from migration 6. The body is otherwise identical.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- disputes
--   One per market (at most). The market state machine guarantees this — you
--   can only open a dispute while the market is `resolving`, and opening a
--   dispute flips it to `in_court`.
-- -----------------------------------------------------------------------------
create type public.dispute_status as enum (
  'voting',     -- voting window open
  'overturned', -- court flipped the outcome
  'upheld',     -- court kept the proposed outcome
  'expired'     -- voting ended with no votes (treated as upheld)
);

create table public.disputes (
  id                uuid primary key default gen_random_uuid(),
  market_id         uuid not null references public.markets(id) on delete cascade,
  initiator_id      uuid not null references auth.users(id),
  -- The outcome the disputer claims is correct (opposite of proposed_outcome).
  claimed_outcome   boolean not null,
  proposed_outcome  boolean not null,
  -- Stake required to open the dispute. Locked in a system_burn account until
  -- the case resolves. If court overturns, returned to disputer; if upheld,
  -- burns to platform.
  stake_amount      bigint not null check (stake_amount >= 100),
  -- Free-text reasoning. We don't allow file uploads in Phase 3 (storage
  -- buckets + virus scanning are deferred).
  reasoning         text check (length(reasoning) <= 4000),
  status            public.dispute_status not null default 'voting',
  voting_starts_at  timestamptz not null default now(),
  voting_ends_at    timestamptz not null,
  votes_overturn    int not null default 0,
  votes_uphold      int not null default 0,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (market_id)  -- one active or historical dispute per market
);

create index disputes_status_idx on public.disputes (status, voting_ends_at);
create index disputes_initiator_idx on public.disputes (initiator_id, created_at desc);

alter table public.disputes enable row level security;

create policy disputes_select_authenticated on public.disputes
  for select to authenticated using (true);

-- No INSERT / UPDATE policy — both go through SECURITY DEFINER RPCs.

-- -----------------------------------------------------------------------------
-- court_votes
-- -----------------------------------------------------------------------------
create table public.court_votes (
  dispute_id   uuid not null references public.disputes(id) on delete cascade,
  voter_id     uuid not null references auth.users(id),
  -- `true` = overturn (agree with disputer), `false` = uphold (agree with admin)
  overturn     boolean not null,
  created_at   timestamptz not null default now(),
  primary key (dispute_id, voter_id)
);

create index court_votes_dispute_idx on public.court_votes (dispute_id);

alter table public.court_votes enable row level security;

create policy court_votes_select_authenticated on public.court_votes
  for select to authenticated using (true);

-- INSERT goes through RPC (we need to enforce eligibility rules that RLS
-- alone cannot express cleanly).

-- =============================================================================
-- Extend notification_kind with court events.
-- (The actual ALTER TYPE ADD VALUE statements live in the _enums.sql sibling
--  so they commit before this script runs.)
-- =============================================================================

-- =============================================================================
-- RPC: propose_resolution
--   Admin proposes an outcome. Market moves to `resolving` with a 24h
--   challenge window. No payouts yet.
-- =============================================================================
create or replace function public.propose_resolution(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_market   public.markets%rowtype;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;

  select * into v_market from public.markets
   where id = p_market_id
   for update;

  if not found then raise exception 'market not found'; end if;
  if v_market.status not in ('open', 'closed') then
    raise exception 'market is %, cannot propose', v_market.status;
  end if;

  update public.markets
     set status             = 'resolving',
         proposed_outcome   = p_outcome,
         challenge_deadline = now() + interval '24 hours'
   where id = p_market_id;

  -- Notify all position holders of the proposed outcome.
  insert into public.event_queue (event_type, payload) values (
    'resolution_proposed',
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome',   p_outcome,
      'question',  v_market.question,
      'yes_label', v_market.outcome_yes_label,
      'no_label',  v_market.outcome_no_label,
      'challenge_deadline', (now() + interval '24 hours')::text
    )
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.propose_resolution(uuid, boolean) from public;
grant  execute on function public.propose_resolution(uuid, boolean) to authenticated;

-- =============================================================================
-- Internal helper: finalize_market_internal(market_id, outcome)
--   Does the actual payout. Mirrors the old resolve_market body. Only called
--   from court_tick (after a window expires) or admin-only force-finalize.
-- =============================================================================
create or replace function public.finalize_market_internal(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market        public.markets%rowtype;
  v_market_pool   uuid;
  v_burn_account  uuid;
  v_tx_id         uuid;
  v_position      record;
  v_user_wallet   uuid;
  v_payout        bigint;
  v_pool_balance  bigint;
begin
  select * into v_market from public.markets
   where id = p_market_id
   for update;

  if not found then raise exception 'market not found'; end if;
  if v_market.status = 'resolved' then return; end if;  -- idempotent
  if v_market.status = 'voided'   then return; end if;

  select id into v_market_pool
    from public.accounts
   where kind = 'system_burn'
     and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_market_pool is null then
    raise exception 'market pool account missing';
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_resolve',
    'market_resolve:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id, 'outcome', p_outcome),
    null
  )
  returning id into v_tx_id;

  for v_position in
    select user_id, yes_shares, no_shares from public.positions
     where market_id = p_market_id
       and ((p_outcome and yes_shares > 0) or (not p_outcome and no_shares > 0))
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
     where market_id = p_market_id and user_id = v_position.user_id;
  end loop;

  select coalesce(sum(amount), 0) into v_pool_balance
    from public.ledger_entries where account_id = v_market_pool;

  if v_pool_balance > 0 then
    select id into v_burn_account
      from public.accounts
     where kind = 'system_burn' and currency = 'vibe' and code = 'market_residual_burn';
    if v_burn_account is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'market_residual_burn')
      returning id into v_burn_account;
    end if;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_market_pool,  -v_pool_balance, 'vibe'),
      (v_tx_id, v_burn_account,  v_pool_balance, 'vibe');
  end if;

  update public.markets
     set status            = 'resolved',
         resolved_outcome  = p_outcome,
         resolved_at       = now()
   where id = p_market_id;

  insert into public.event_queue (event_type, payload) values (
    'market_resolved',
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome',   p_outcome,
      'question',  v_market.question,
      'yes_label', v_market.outcome_yes_label,
      'no_label',  v_market.outcome_no_label
    )
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.finalize_market_internal(uuid, boolean) from public;
-- Only callable by other SECURITY DEFINER functions and the service role.

-- =============================================================================
-- RPC: open_dispute
--   The disputer must:
--     - not be the market creator
--     - have held shares on the losing side at proposal time (or have any
--       position on this market — for Phase 3 v1 we just require ANY position
--       to keep eligibility checks simple)
--     - put up stake = max(5% of total trade volume, 100), capped at 10,000
--
-- Stake is debited from the disputer's VIBE wallet and credited to a
-- per-dispute escrow account.
-- =============================================================================
create or replace function public.open_dispute(
  p_market_id      uuid,
  p_reasoning      text
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
  if v_market.status <> 'resolving' then
    raise exception 'market is %, cannot dispute', v_market.status;
  end if;
  if v_market.challenge_deadline is null or v_market.challenge_deadline < now() then
    raise exception 'challenge window has closed';
  end if;
  if v_market.creator_id = v_user_id then
    raise exception 'creator cannot dispute their own market';
  end if;

  -- Must have any position on this market
  select * into v_position from public.positions
   where market_id = p_market_id and user_id = v_user_id;
  if not found or (v_position.yes_shares = 0 and v_position.no_shares = 0) then
    raise exception 'must hold a position to open a dispute';
  end if;

  -- Compute stake = max(volume * 0.05, 100), capped at 10_000
  select coalesce(sum(abs(cost)), 0)::bigint into v_volume
    from public.trades where market_id = p_market_id;

  v_stake := greatest(100, (v_volume / 20)::bigint);
  if v_stake > 10000 then v_stake := 10000; end if;

  -- Check balance + debit
  select id into v_user_wallet
    from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < v_stake then
    raise exception 'insufficient stake: need % VIBE, have %', v_stake, v_balance;
  end if;

  -- Create the dispute row first (we need its id for the escrow code)
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

  -- Per-dispute escrow account
  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'dispute_escrow:' || v_dispute_id::text)
  returning id into v_escrow;

  -- Ledger: user → escrow
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

  -- Flip market state
  update public.markets
     set status         = 'in_court',
         voting_ends_at = now() + interval '48 hours'
   where id = p_market_id;

  -- Emit event
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

revoke execute on function public.open_dispute(uuid, text) from public;
grant  execute on function public.open_dispute(uuid, text) to authenticated;

-- =============================================================================
-- RPC: cast_vote
--   Eligibility:
--     - not the disputer
--     - not the market creator
--     - has not traded this market (impartiality)
--     - dispute still in 'voting' status
--   One vote per user per dispute (PK enforces).
-- =============================================================================
create or replace function public.cast_vote(
  p_dispute_id uuid,
  p_overturn   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_dispute     public.disputes%rowtype;
  v_market      public.markets%rowtype;
  v_has_traded  boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_dispute from public.disputes
   where id = p_dispute_id
   for update;
  if not found then raise exception 'dispute not found'; end if;
  if v_dispute.status <> 'voting' then
    raise exception 'voting is closed for this dispute';
  end if;
  if v_dispute.voting_ends_at < now() then
    raise exception 'voting window has ended';
  end if;
  if v_dispute.initiator_id = v_user_id then
    raise exception 'disputer cannot vote on own case';
  end if;

  select * into v_market from public.markets where id = v_dispute.market_id;
  if v_market.creator_id = v_user_id then
    raise exception 'market creator cannot vote';
  end if;

  select exists (
    select 1 from public.trades where market_id = v_dispute.market_id and user_id = v_user_id
  ) into v_has_traded;
  if v_has_traded then
    raise exception 'traders in this market cannot vote (impartiality rule)';
  end if;

  insert into public.court_votes (dispute_id, voter_id, overturn)
  values (p_dispute_id, v_user_id, p_overturn)
  on conflict (dispute_id, voter_id) do nothing;

  if not found then
    -- already voted; silent no-op
    return;
  end if;

  -- Update tally
  if p_overturn then
    update public.disputes set votes_overturn = votes_overturn + 1 where id = p_dispute_id;
  else
    update public.disputes set votes_uphold = votes_uphold + 1 where id = p_dispute_id;
  end if;
end;
$$;

revoke execute on function public.cast_vote(uuid, boolean) from public;
grant  execute on function public.cast_vote(uuid, boolean) to authenticated;

-- =============================================================================
-- Internal: resolve_dispute_internal(dispute_id)
--   Called from court_tick when voting_ends_at has passed.
--   Tallies votes, settles stake, finalizes the market.
-- =============================================================================
create or replace function public.resolve_dispute_internal(p_dispute_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute        public.disputes%rowtype;
  v_market         public.markets%rowtype;
  v_overturn       boolean;
  v_final_outcome  boolean;
  v_escrow         uuid;
  v_user_wallet    uuid;
  v_burn_account   uuid;
  v_tx_id          uuid;
  v_total_votes    int;
  v_new_status     public.dispute_status;
begin
  select * into v_dispute from public.disputes
   where id = p_dispute_id
   for update;
  if not found then return; end if;
  if v_dispute.status <> 'voting' then return; end if;
  if v_dispute.voting_ends_at > now() then return; end if;

  v_total_votes := v_dispute.votes_overturn + v_dispute.votes_uphold;
  v_overturn := v_dispute.votes_overturn > v_dispute.votes_uphold;

  if v_total_votes = 0 then
    v_new_status := 'expired';
    -- No votes = uphold by default
    v_final_outcome := v_dispute.proposed_outcome;
  elsif v_overturn then
    v_new_status := 'overturned';
    v_final_outcome := v_dispute.claimed_outcome;
  else
    v_new_status := 'upheld';
    v_final_outcome := v_dispute.proposed_outcome;
  end if;

  -- Settle stake
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'dispute_escrow:' || p_dispute_id::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'dispute_resolve',
    'dispute_resolve:' || p_dispute_id::text,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'status', v_new_status,
      'votes_overturn', v_dispute.votes_overturn,
      'votes_uphold', v_dispute.votes_uphold
    ),
    null
  )
  returning id into v_tx_id;

  if v_overturn then
    -- Refund disputer
    select id into v_user_wallet
      from public.accounts
     where owner_user_id = v_dispute.initiator_id
       and kind = 'user_wallet' and currency = 'vibe';
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow,      -v_dispute.stake_amount, 'vibe'),
      (v_tx_id, v_user_wallet,  v_dispute.stake_amount, 'vibe');
  else
    -- Burn stake (upheld or expired)
    select id into v_burn_account
      from public.accounts
     where kind = 'system_burn' and currency = 'vibe' and code = 'dispute_stake_burn';
    if v_burn_account is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'dispute_stake_burn')
      returning id into v_burn_account;
    end if;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow,        -v_dispute.stake_amount, 'vibe'),
      (v_tx_id, v_burn_account,   v_dispute.stake_amount, 'vibe');
  end if;

  update public.disputes
     set status      = v_new_status,
         resolved_at = now()
   where id = p_dispute_id;

  -- Finalize the market with whichever outcome won
  perform public.finalize_market_internal(v_dispute.market_id, v_final_outcome);

  -- Emit notification event
  insert into public.event_queue (event_type, payload) values (
    'dispute_resolved',
    jsonb_build_object(
      'dispute_id',  p_dispute_id,
      'market_id',   v_dispute.market_id,
      'status',      v_new_status,
      'final_outcome', v_final_outcome,
      'initiator_id', v_dispute.initiator_id,
      'stake_refunded', v_overturn,
      'stake_amount',  v_dispute.stake_amount
    )
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.resolve_dispute_internal(uuid) from public;

-- =============================================================================
-- RPC: court_tick
--   Opportunistic ticker. Anyone can call this — it's idempotent and bounded.
--   We'll fire it from page loads (server side) so we don't need pg_cron.
--
--   Does two things:
--     1. Finalize `resolving` markets whose challenge_deadline has passed.
--     2. Resolve `in_court` disputes whose voting_ends_at has passed.
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
    select id, proposed_outcome from public.markets
     where status = 'resolving'
       and challenge_deadline is not null
       and challenge_deadline < now()
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  loop
    begin
      perform public.finalize_market_internal(v_market.id, v_market.proposed_outcome);
      v_count := v_count + 1;
    exception when others then
      -- swallow per-row errors; tick should not abort
      null;
    end;
  end loop;

  -- 2) Auto-resolve disputes past voting window
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

revoke execute on function public.court_tick(int) from public;
grant  execute on function public.court_tick(int) to authenticated, anon;
-- safe to expose: idempotent, capped, no side effects unless a window expired.

-- =============================================================================
-- Extend process_event_queue to handle the new event types.
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
        -- Notify the disputer
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

-- (existing grants from migration 7 still apply)
