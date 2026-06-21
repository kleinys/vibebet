-- =============================================================================
-- Phase 4.5 + 5.6: Categorical court + Resolution Polls (paid extra votes)
-- =============================================================================

-- Outcome indices for multi-outcome disputes (binary keeps using booleans).
alter table public.disputes
  add column if not exists claimed_outcome_index  int,
  add column if not exists proposed_outcome_index int;

-- Allow multiple votes per user; each vote is a separate row.
alter table public.court_votes
  drop constraint if exists court_votes_pkey;

alter table public.court_votes
  add column if not exists id         uuid not null default gen_random_uuid(),
  add column if not exists vote_number int not null default 1,
  add column if not exists vibe_cost   bigint not null default 0;

update public.court_votes set id = gen_random_uuid() where id is null;

alter table public.court_votes
  add primary key (id);

create unique index if not exists court_votes_dispute_voter_seq_idx
  on public.court_votes (dispute_id, voter_id, vote_number);

-- ---------------------------------------------------------------------------
-- RPC: get_next_vote_cost — first vote free, then 50 VIBE × vote_number
-- (≈ $1/play-money unit per extra vote in the closed-loop economy).
-- ---------------------------------------------------------------------------
create or replace function public.get_next_vote_cost(p_dispute_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count   int;
begin
  if v_user_id is null then return null; end if;
  select count(*)::int into v_count
    from public.court_votes
   where dispute_id = p_dispute_id and voter_id = v_user_id;
  if v_count = 0 then return 0; end if;
  return (v_count + 1) * 50;
end;
$$;

revoke execute on function public.get_next_vote_cost(uuid) from public;
grant  execute on function public.get_next_vote_cost(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: open_dispute — binary + categorical; community + official markets
-- ---------------------------------------------------------------------------
create or replace function public.open_dispute(
  p_market_id             uuid,
  p_reasoning             text,
  p_claimed_outcome_index int default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_market         public.markets%rowtype;
  v_position       public.positions%rowtype;
  v_cat_shares     bigint;
  v_volume         bigint;
  v_stake          bigint;
  v_balance        bigint;
  v_user_wallet    uuid;
  v_escrow         uuid;
  v_dispute_id     uuid;
  v_tx_id          uuid;
  v_n              int;
  v_claimed_bool   boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;

  -- Mirrors are read-only discovery — no disputes.
  if v_market.source = 'polymarket_mirror' then
    raise exception 'Polymarket mirror markets cannot be disputed on Vibebet';
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

  if v_market.kind = 'categorical' then
    if p_claimed_outcome_index is null then
      raise exception 'pick the outcome you believe is correct';
    end if;
    select count(*)::int into v_n
      from public.market_outcomes where market_id = p_market_id;
    if p_claimed_outcome_index < 0 or p_claimed_outcome_index >= v_n then
      raise exception 'invalid outcome index';
    end if;
    if p_claimed_outcome_index = v_market.proposed_outcome_index then
      raise exception 'claimed outcome must differ from the proposed winner';
    end if;
    select coalesce(sum(shares), 0)::bigint into v_cat_shares
      from public.categorical_positions
     where market_id = p_market_id and user_id = v_user_id;
    if v_cat_shares <= 0 then
      raise exception 'must hold shares in this market to open a dispute';
    end if;
  else
    select * into v_position from public.positions
     where market_id = p_market_id and user_id = v_user_id;
    if not found or (v_position.yes_shares = 0 and v_position.no_shares = 0) then
      raise exception 'must hold a position to open a dispute';
    end if;
    v_claimed_bool := not coalesce(v_market.proposed_outcome, false);
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

  insert into public.disputes (
    market_id, initiator_id,
    claimed_outcome, proposed_outcome,
    claimed_outcome_index, proposed_outcome_index,
    stake_amount, reasoning, voting_ends_at
  ) values (
    p_market_id, v_user_id,
    coalesce(v_claimed_bool, false),
    coalesce(v_market.proposed_outcome, false),
    case when v_market.kind = 'categorical' then p_claimed_outcome_index else null end,
    case when v_market.kind = 'categorical' then v_market.proposed_outcome_index else null end,
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

-- ---------------------------------------------------------------------------
-- RPC: cast_vote — Resolution Poll: anyone can vote; extra votes cost VIBE
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_dispute_id uuid,
  p_overturn   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_dispute      public.disputes%rowtype;
  v_vote_count   int;
  v_cost         bigint;
  v_side         boolean;
  v_user_wallet  uuid;
  v_balance      bigint;
  v_burn         uuid;
  v_tx_id        uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found'; end if;
  if v_dispute.status <> 'voting' then
    raise exception 'voting is closed for this poll';
  end if;
  if v_dispute.voting_ends_at < now() then
    raise exception 'voting window has ended';
  end if;
  if v_dispute.initiator_id = v_user_id then
    raise exception 'disputer cannot vote on own case';
  end if;

  select count(*)::int into v_vote_count
    from public.court_votes
   where dispute_id = p_dispute_id and voter_id = v_user_id;

  v_cost := case when v_vote_count = 0 then 0 else (v_vote_count + 1) * 50 end;

  if v_vote_count > 0 then
    select overturn into v_side
      from public.court_votes
     where dispute_id = p_dispute_id and voter_id = v_user_id
     order by vote_number asc limit 1;
    if v_side is distinct from p_overturn then
      raise exception 'additional votes must match your first vote';
    end if;
  end if;

  if v_cost > 0 then
    select id into v_user_wallet
      from public.accounts
     where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
    select coalesce(sum(amount), 0) into v_balance
      from public.ledger_entries where account_id = v_user_wallet;
    if v_balance < v_cost then
      raise exception 'need % VIBE for vote #%', v_cost, v_vote_count + 1;
    end if;

    select id into v_burn from public.accounts
     where kind = 'system_burn' and currency = 'vibe' and code = 'poll_vote_burn';
    if v_burn is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'poll_vote_burn')
      returning id into v_burn;
    end if;

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'poll_vote',
      'poll_vote:' || p_dispute_id::text || ':' || v_user_id::text || ':' || (v_vote_count + 1)::text,
      jsonb_build_object('dispute_id', p_dispute_id, 'vote_number', v_vote_count + 1),
      v_user_id
    )
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet, -v_cost, 'vibe'),
      (v_tx_id, v_burn,         v_cost, 'vibe');
  end if;

  insert into public.court_votes (dispute_id, voter_id, overturn, vote_number, vibe_cost)
  values (p_dispute_id, v_user_id, p_overturn, v_vote_count + 1, v_cost);

  if p_overturn then
    update public.disputes set votes_overturn = votes_overturn + 1 where id = p_dispute_id;
  else
    update public.disputes set votes_uphold = votes_uphold + 1 where id = p_dispute_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_dispute_internal — categorical branch
-- ---------------------------------------------------------------------------
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
  v_final_index    int;
  v_escrow         uuid;
  v_user_wallet    uuid;
  v_burn_account   uuid;
  v_tx_id          uuid;
  v_total_votes    int;
  v_new_status     public.dispute_status;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then return; end if;
  if v_dispute.status <> 'voting' then return; end if;
  if v_dispute.voting_ends_at > now() then return; end if;

  select * into v_market from public.markets where id = v_dispute.market_id;

  v_total_votes := v_dispute.votes_overturn + v_dispute.votes_uphold;
  v_overturn := v_dispute.votes_overturn > v_dispute.votes_uphold;

  if v_total_votes = 0 then
    v_new_status := 'expired';
    v_final_outcome := v_dispute.proposed_outcome;
    v_final_index   := v_dispute.proposed_outcome_index;
  elsif v_overturn then
    v_new_status := 'overturned';
    v_final_outcome := v_dispute.claimed_outcome;
    v_final_index   := v_dispute.claimed_outcome_index;
  else
    v_new_status := 'upheld';
    v_final_outcome := v_dispute.proposed_outcome;
    v_final_index   := v_dispute.proposed_outcome_index;
  end if;

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
    select id into v_user_wallet
      from public.accounts
     where owner_user_id = v_dispute.initiator_id
       and kind = 'user_wallet' and currency = 'vibe';
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow,      -v_dispute.stake_amount, 'vibe'),
      (v_tx_id, v_user_wallet,  v_dispute.stake_amount, 'vibe');
  else
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
     set status = v_new_status, resolved_at = now()
   where id = p_dispute_id;

  if v_market.kind = 'categorical' then
    if v_final_index is not null then
      perform public.finalize_categorical_internal(v_dispute.market_id, v_final_index);
    end if;
  else
    perform public.finalize_market_internal(v_dispute.market_id, v_final_outcome);
  end if;

  insert into public.event_queue (event_type, payload) values (
    'dispute_resolved',
    jsonb_build_object(
      'dispute_id',  p_dispute_id,
      'market_id',   v_dispute.market_id,
      'status',      v_new_status,
      'initiator_id', v_dispute.initiator_id,
      'stake_refunded', v_overturn,
      'stake_amount',  v_dispute.stake_amount
    )
  );
  perform public.process_event_queue(200);
end;
$$;

-- ---------------------------------------------------------------------------
-- Community markets: creator can propose resolution when market closes
-- ---------------------------------------------------------------------------
create or replace function public.propose_resolution_community(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_market  public.markets%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.source <> 'community' then
    raise exception 'only community markets use creator-proposed resolution';
  end if;
  if v_market.creator_id <> v_user_id then
    raise exception 'only the market creator can propose resolution';
  end if;
  if v_market.kind <> 'binary' then
    raise exception 'use propose_resolution_categorical for multi-outcome markets';
  end if;
  if v_market.status not in ('open', 'closed') then
    raise exception 'market is %, cannot propose', v_market.status;
  end if;

  update public.markets
     set status             = 'resolving',
         proposed_outcome   = p_outcome,
         challenge_deadline = now() + interval '24 hours',
         voting_ends_at     = null
   where id = p_market_id;

  insert into public.event_queue (event_type, payload) values (
    'resolution_proposed',
    jsonb_build_object('market_id', p_market_id, 'outcome', p_outcome)
  );
  perform public.process_event_queue(200);
end;
$$;

revoke execute on function public.propose_resolution_community(uuid, boolean) from public;
grant  execute on function public.propose_resolution_community(uuid, boolean) to authenticated;

-- Slightly livelier official markets (still tiny — play money only).
create or replace function public.platform_activity_tick(p_limit int default 4)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bot_id    uuid;
  v_count     int := 0;
  v_market    record;
  v_cost      bigint;
  v_side      public.trade_side;
begin
  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then return 0; end if;

  perform public._fund_platform_bot(3000);

  for v_market in
    select id, reserve_yes, reserve_no
      from public.markets
     where status = 'open'
       and kind = 'binary'
       and source in ('platform', 'community')
       and id not in (
         select t.market_id from public.trades t
          where t.user_id = v_bot_id
            and t.created_at > now() - interval '90 minutes'
       )
     order by random()
     limit greatest(1, least(coalesce(p_limit, 4), 6))
  loop
    begin
      v_cost := 8 + floor(random() * 18)::bigint;
      v_side := case when random() < 0.5 then 'yes'::public.trade_side else 'no'::public.trade_side end;
      perform public.place_trade(v_market.id, v_side, v_cost);
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$$;
