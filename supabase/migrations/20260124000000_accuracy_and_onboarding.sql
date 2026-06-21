-- =============================================================================
-- Phase 9: Accuracy & reputation + Onboarding progress + Analytics events
-- =============================================================================

-- Trade-time implied YES probability (for Brier scoring at resolution).
alter table public.trades
  add column if not exists entry_yes_prob numeric check (entry_yes_prob >= 0 and entry_yes_prob <= 1),
  add column if not exists prediction_scored boolean not null default false;

-- Aggregated accuracy on profile (updated when markets resolve).
alter table public.profiles
  add column if not exists predictions_scored int not null default 0 check (predictions_scored >= 0),
  add column if not exists correct_predictions int not null default 0 check (correct_predictions >= 0),
  add column if not exists brier_sum numeric not null default 0 check (brier_sum >= 0);

-- First-run wizard state.
create table if not exists public.onboarding_progress (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  step              int not null default 0 check (step between 0 and 4),
  interests         text[] not null default '{}',
  first_bet_at      timestamptz,
  first_bet_market_id uuid references public.markets(id) on delete set null,
  completed_at      timestamptz,
  skipped_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.onboarding_progress enable row level security;

drop policy if exists onboarding_select_own on public.onboarding_progress;
create policy onboarding_select_own on public.onboarding_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists onboarding_insert_own on public.onboarding_progress;
create policy onboarding_insert_own on public.onboarding_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists onboarding_update_own on public.onboarding_progress;
create policy onboarding_update_own on public.onboarding_progress
  for update to authenticated using (user_id = auth.uid());

-- Lightweight product analytics (PostHog-ready export).
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  event_name  text not null,
  properties  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_insert_own on public.analytics_events;
create policy analytics_insert_own on public.analytics_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists analytics_select_admin on public.analytics_events;
create policy analytics_select_admin on public.analytics_events
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Score all unscored trades when a binary market resolves.
-- ---------------------------------------------------------------------------
create or replace function public._score_market_predictions(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade   record;
  v_y       int;
  v_brier   numeric;
  v_correct boolean;
begin
  v_y := case when p_outcome then 1 else 0 end;

  for v_trade in
    select id, user_id, side, coalesce(entry_yes_prob, 0.5) as entry_prob
      from public.trades
     where market_id = p_market_id
       and side is not null
       and not prediction_scored
  loop
    v_brier := power(v_trade.entry_prob - v_y, 2);
    v_correct := (v_trade.side = 'yes' and p_outcome)
              or (v_trade.side = 'no' and not p_outcome);

    update public.profiles
       set predictions_scored  = predictions_scored + 1,
           correct_predictions = correct_predictions + case when v_correct then 1 else 0 end,
           brier_sum           = brier_sum + v_brier,
           updated_at          = now()
     where id = v_trade.user_id;

    update public.trades
       set prediction_scored = true
     where id = v_trade.id;
  end loop;
end;
$$;

revoke execute on function public._score_market_predictions(uuid, boolean) from public;

-- Patch finalize to score predictions.
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
  if v_market.status = 'resolved' then return; end if;
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

  if v_market.kind = 'binary' then
    perform public._score_market_predictions(p_market_id, p_outcome);
  end if;

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

-- Record entry_yes_prob + first-bet onboarding hook on trades.
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
  v_user_id         uuid := auth.uid();
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
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then
    raise exception 'market not open (status=%)', v_market.status;
  end if;
  if v_market.fast_asset is not null and v_market.window_end is not null
     and v_market.window_end <= now() then
    raise exception 'fast market window has ended';
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed at %', v_market.closes_at;
  end if;

  v_entry_yes_prob := v_market.reserve_no::numeric
    / nullif(v_market.reserve_yes + v_market.reserve_no, 0);

  select id into v_user_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'trader wallet not found'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < p_cost then
    raise exception 'insufficient balance: have %, need %', v_balance, p_cost;
  end if;

  select id into v_market_pool from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_market_pool is null then raise exception 'market pool account missing'; end if;

  v_fee := 0;
  if coalesce(v_market.creator_fee_bps, 0) > 0
     and v_market.creator_id is not null
     and v_market.creator_id <> v_user_id then
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
      'entry_yes_prob', v_entry_yes_prob
    ),
    v_user_id
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
    p_market_id, v_user_id, p_side, p_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id, v_entry_yes_prob
  ) returning id into v_trade_id;

  insert into public.positions (market_id, user_id, yes_shares, no_shares, total_cost)
  values (
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

  perform public._record_first_bet(v_user_id, p_market_id);

  return query select v_trade_id, v_shares, v_yes_after, v_no_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding RPCs
-- ---------------------------------------------------------------------------
create or replace function public._record_first_bet(p_user_id uuid, p_market_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.onboarding_progress (user_id, first_bet_at, first_bet_market_id, step)
  values (p_user_id, now(), p_market_id, greatest(2, 2))
  on conflict (user_id) do update set
    first_bet_at = coalesce(public.onboarding_progress.first_bet_at, excluded.first_bet_at),
    first_bet_market_id = coalesce(public.onboarding_progress.first_bet_market_id, excluded.first_bet_market_id),
    step = greatest(public.onboarding_progress.step, 2),
    updated_at = now()
  where public.onboarding_progress.first_bet_at is null;
end;
$$;

revoke execute on function public._record_first_bet(uuid, uuid) from public;

create or replace function public.get_onboarding_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_row     public.onboarding_progress%rowtype;
begin
  if v_user_id is null then return jsonb_build_object('skipped', true); end if;

  insert into public.onboarding_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.onboarding_progress where user_id = v_user_id;

  return jsonb_build_object(
    'step', v_row.step,
    'interests', to_jsonb(v_row.interests),
    'first_bet_at', v_row.first_bet_at,
    'completed', v_row.completed_at is not null,
    'skipped', v_row.skipped_at is not null
  );
end;
$$;

revoke execute on function public.get_onboarding_state() from public;
grant  execute on function public.get_onboarding_state() to authenticated;

create or replace function public.save_onboarding_interests(p_interests text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if coalesce(array_length(p_interests, 1), 0) < 1 then
    raise exception 'pick at least one interest';
  end if;

  insert into public.onboarding_progress (user_id, interests, step)
  values (v_user_id, p_interests, 1)
  on conflict (user_id) do update set
    interests = excluded.interests,
    step = greatest(public.onboarding_progress.step, 1),
    updated_at = now();
end;
$$;

revoke execute on function public.save_onboarding_interests(text[]) from public;
grant  execute on function public.save_onboarding_interests(text[]) to authenticated;

create or replace function public.complete_onboarding(p_skip boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  insert into public.onboarding_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  if p_skip then
    update public.onboarding_progress
       set skipped_at = now(), step = 4, updated_at = now()
     where user_id = v_user_id;
  else
    update public.onboarding_progress
       set completed_at = now(), step = 4, updated_at = now()
     where user_id = v_user_id;
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(boolean) from public;
grant  execute on function public.complete_onboarding(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Accuracy stats + leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.get_accuracy_stats(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_p       public.profiles%rowtype;
  v_accuracy numeric;
  v_brier    numeric;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_p from public.profiles where id = v_user_id;
  if not found then return '{}'::jsonb; end if;

  if v_p.predictions_scored > 0 then
    v_accuracy := v_p.correct_predictions::numeric / v_p.predictions_scored;
    v_brier := v_p.brier_sum / v_p.predictions_scored;
  else
    v_accuracy := null;
    v_brier := null;
  end if;

  return jsonb_build_object(
    'predictions_scored', v_p.predictions_scored,
    'correct_predictions', v_p.correct_predictions,
    'accuracy_pct', case when v_accuracy is not null then round(v_accuracy * 100, 1) else null end,
    'avg_brier', case when v_brier is not null then round(v_brier, 4) else null end
  );
end;
$$;

revoke execute on function public.get_accuracy_stats(uuid) from public;
grant  execute on function public.get_accuracy_stats(uuid) to authenticated;

create or replace function public.accuracy_leaderboard(p_limit int default 25)
returns table (
  rank               int,
  user_id            uuid,
  display_name       text,
  predictions_scored int,
  accuracy_pct       numeric,
  avg_brier          numeric
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    row_number() over (
      order by
        (p.correct_predictions::numeric / nullif(p.predictions_scored, 0)) desc,
        p.predictions_scored desc
    )::int as rank,
    p.id as user_id,
    p.display_name,
    p.predictions_scored,
    round(100.0 * p.correct_predictions / p.predictions_scored, 1) as accuracy_pct,
    round(p.brier_sum / p.predictions_scored, 4) as avg_brier
  from public.profiles p
  where p.predictions_scored >= 5
  order by
    (p.correct_predictions::numeric / p.predictions_scored) desc,
    p.predictions_scored desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.accuracy_leaderboard(int) from public;
grant  execute on function public.accuracy_leaderboard(int) to authenticated, anon;

-- Analytics event insert (server-side).
create or replace function public.track_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (user_id, event_name, properties)
  values (auth.uid(), p_event_name, coalesce(p_properties, '{}'::jsonb));
end;
$$;

revoke execute on function public.track_event(text, jsonb) from public;
grant  execute on function public.track_event(text, jsonb) to authenticated;

-- Accuracy achievements in check_achievements.
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
begin
  if p_user_id is null then return 0; end if;

  select current_streak, predictions_scored, correct_predictions
    into v_streak, v_scored, v_correct
    from public.profiles where id = p_user_id;

  select count(*)::int into v_trades from public.trades where user_id = p_user_id;
  select count(*)::int into v_markets from public.markets where creator_id = p_user_id;
  select count(*)::int into v_comments from public.market_comments where user_id = p_user_id;

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

  return v_count;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values
  (
    'onboarding_wizard_enabled',
    false,
    '5-step first-run wizard after signup (interests → explainer → first bet)'
  ),
  (
    'accuracy_leaderboard_enabled',
    false,
    'Brier-scored accuracy stats and Sharp Minds leaderboard'
  )
on conflict (key) do update set description = excluded.description;
