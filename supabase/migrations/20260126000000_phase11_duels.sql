-- =============================================================================
-- Phase 11: Prediction Duels — head-to-head VIBE stakes on open markets
-- =============================================================================

create table if not exists public.duels (
  id               uuid primary key default gen_random_uuid(),
  challenger_id    uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  market_id        uuid not null references public.markets(id) on delete cascade,
  challenger_side  public.trade_side not null,
  opponent_side    public.trade_side,
  stake            bigint not null check (stake >= 10 and stake <= 100000),
  status           text not null default 'pending'
    check (status in ('pending', 'accepted', 'settled', 'cancelled', 'declined', 'expired')),
  winner_id        uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  settled_at       timestamptz,
  constraint duels_different_users check (opponent_id is null or opponent_id <> challenger_id)
);

create index if not exists duels_market_status_idx
  on public.duels (market_id, status);

create index if not exists duels_challenger_idx
  on public.duels (challenger_id, status, created_at desc);

create index if not exists duels_opponent_idx
  on public.duels (opponent_id, status, created_at desc);

create index if not exists duels_open_idx
  on public.duels (status, created_at desc)
  where status = 'pending';

alter table public.duels enable row level security;

drop policy if exists duels_select on public.duels;
create policy duels_select on public.duels
  for select to authenticated
  using (
    challenger_id = auth.uid()
    or opponent_id = auth.uid()
    or (status = 'pending' and opponent_id is null)
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._duel_escrow_code(p_duel_id uuid)
returns text
language sql
immutable
as $$
  select 'duel_escrow:' || p_duel_id::text;
$$;

create or replace function public._wallet_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.accounts
   where owner_user_id = p_user_id
     and kind = 'user_wallet'
     and currency = 'vibe'
   limit 1;
$$;

revoke execute on function public._wallet_for_user(uuid) from public;

create or replace function public._debit_wallet_to_escrow(
  p_user_id    uuid,
  p_amount     bigint,
  p_kind       text,
  p_external   text,
  p_escrow_code text,
  p_metadata   jsonb
) returns uuid
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
  if v_balance < p_amount then
    raise exception 'insufficient VIBE: need %, have %', p_amount, v_balance;
  end if;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', p_escrow_code)
  returning id into v_escrow;
  if v_escrow is null then raise exception 'escrow account missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_kind, p_external, p_metadata, p_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_amount, 'vibe'),
    (v_tx_id, v_escrow,  p_amount, 'vibe');

  return v_tx_id;
end;
$$;

revoke execute on function public._debit_wallet_to_escrow(uuid, bigint, text, text, text, jsonb) from public;

create or replace function public._refund_duel_escrow(
  p_duel_id uuid,
  p_user_id uuid,
  p_amount  bigint,
  p_kind    text
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
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn'
     and currency = 'vibe'
     and code = public._duel_escrow_code(p_duel_id);
  if v_escrow is null then return; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    p_kind,
    p_kind || ':' || p_duel_id::text || ':' || p_user_id::text,
    jsonb_build_object('duel_id', p_duel_id),
    p_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -p_amount, 'vibe'),
    (v_tx_id, v_wallet,  p_amount, 'vibe');
end;
$$;

revoke execute on function public._refund_duel_escrow(uuid, uuid, bigint, text) from public;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_duel(
  p_market_id          uuid,
  p_side               public.trade_side,
  p_stake              bigint,
  p_opponent_username  text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_market      public.markets%rowtype;
  v_opponent_id uuid;
  v_duel_id     uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 100000 then raise exception 'stake must be 10–100,000 VIBE'; end if;

  select * into v_market from public.markets where id = p_market_id;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then raise exception 'market is not open'; end if;
  if v_market.kind <> 'binary' then raise exception 'duels only on binary markets'; end if;

  if p_opponent_username is not null and length(trim(p_opponent_username)) > 0 then
    select id into v_opponent_id from public.profiles
     where lower(username) = lower(trim(p_opponent_username));
    if v_opponent_id is null then raise exception 'user not found'; end if;
    if v_opponent_id = v_user_id then raise exception 'cannot duel yourself'; end if;
  end if;

  insert into public.duels (
    challenger_id, opponent_id, market_id, challenger_side, stake
  ) values (
    v_user_id, v_opponent_id, p_market_id, p_side, p_stake
  ) returning id into v_duel_id;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    p_stake,
    'duel_create',
    'duel_create:' || v_duel_id::text,
    public._duel_escrow_code(v_duel_id),
    jsonb_build_object('duel_id', v_duel_id, 'market_id', p_market_id)
  );

  return v_duel_id;
end;
$$;

revoke execute on function public.create_duel(uuid, public.trade_side, bigint, text) from public;
grant  execute on function public.create_duel(uuid, public.trade_side, bigint, text) to authenticated;

create or replace function public.accept_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.duels%rowtype;
  v_market  public.markets%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'pending' then raise exception 'duel is not pending'; end if;
  if v_duel.expires_at <= now() then raise exception 'duel expired'; end if;
  if v_duel.challenger_id = v_user_id then raise exception 'cannot accept your own duel'; end if;
  if v_duel.opponent_id is not null and v_duel.opponent_id <> v_user_id then
    raise exception 'this duel is for someone else';
  end if;

  select * into v_market from public.markets where id = v_duel.market_id;
  if v_market.status <> 'open' then raise exception 'market is no longer open'; end if;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    v_duel.stake,
    'duel_accept',
    'duel_accept:' || p_duel_id::text,
    public._duel_escrow_code(p_duel_id),
    jsonb_build_object('duel_id', p_duel_id)
  );

  update public.duels
     set status = 'accepted',
         opponent_id = v_user_id,
         opponent_side = case when v_duel.challenger_side = 'yes' then 'no'::public.trade_side else 'yes'::public.trade_side end,
         accepted_at = now()
   where id = p_duel_id;
end;
$$;

revoke execute on function public.accept_duel(uuid) from public;
grant  execute on function public.accept_duel(uuid) to authenticated;

create or replace function public.cancel_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.duels%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.challenger_id <> v_user_id then raise exception 'only challenger can cancel'; end if;
  if v_duel.status <> 'pending' then raise exception 'can only cancel pending duels'; end if;

  perform public._refund_duel_escrow(p_duel_id, v_duel.challenger_id, v_duel.stake, 'duel_cancel');

  update public.duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

revoke execute on function public.cancel_duel(uuid) from public;
grant  execute on function public.cancel_duel(uuid) to authenticated;

create or replace function public.decline_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.duels%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'pending' then raise exception 'duel is not pending'; end if;
  if v_duel.opponent_id is null or v_duel.opponent_id <> v_user_id then
    raise exception 'not the invited opponent';
  end if;

  perform public._refund_duel_escrow(p_duel_id, v_duel.challenger_id, v_duel.stake, 'duel_decline');

  update public.duels set status = 'declined' where id = p_duel_id;
end;
$$;

revoke execute on function public.decline_duel(uuid) from public;
grant  execute on function public.decline_duel(uuid) to authenticated;

create or replace function public._settle_duels_for_market(
  p_market_id uuid,
  p_outcome   boolean
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel   record;
  v_winner uuid;
  v_wallet uuid;
  v_escrow uuid;
  v_tx_id  uuid;
  v_count  int := 0;
begin
  for v_duel in
    select * from public.duels
     where market_id = p_market_id and status = 'accepted'
     for update
  loop
    if (v_duel.challenger_side = 'yes' and p_outcome)
       or (v_duel.challenger_side = 'no' and not p_outcome) then
      v_winner := v_duel.challenger_id;
    else
      v_winner := v_duel.opponent_id;
    end if;

    select public._wallet_for_user(v_winner) into v_wallet;
    select id into v_escrow from public.accounts
     where kind = 'system_burn'
       and currency = 'vibe'
       and code = public._duel_escrow_code(v_duel.id);

    if v_wallet is not null and v_escrow is not null then
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values (
        'duel_settle',
        'duel_settle:' || v_duel.id::text,
        jsonb_build_object('duel_id', v_duel.id, 'winner_id', v_winner),
        null
      ) returning id into v_tx_id;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -(v_duel.stake * 2), 'vibe'),
        (v_tx_id, v_wallet,  (v_duel.stake * 2), 'vibe');
    end if;

    update public.duels
       set status = 'settled', winner_id = v_winner, settled_at = now()
     where id = v_duel.id;

    perform public.check_achievements(v_winner);

    v_count := v_count + 1;
  end loop;

  -- Refund pending duels on closed markets
  for v_duel in
    select * from public.duels
     where market_id = p_market_id and status = 'pending'
     for update
  loop
    perform public._refund_duel_escrow(v_duel.id, v_duel.challenger_id, v_duel.stake, 'duel_market_closed');
    update public.duels set status = 'cancelled' where id = v_duel.id;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public._settle_duels_for_market(uuid, boolean) from public;

create or replace function public._duels_on_market_resolve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved'
     and new.resolved_outcome is not null then
    perform public._settle_duels_for_market(new.id, new.resolved_outcome);
  end if;
  return new;
end;
$$;

drop trigger if exists duels_settle_on_resolve on public.markets;
create trigger duels_settle_on_resolve
  after update of status on public.markets
  for each row execute function public._duels_on_market_resolve();

create or replace function public.get_open_duels(p_limit int default 20)
returns table (
  id               uuid,
  challenger_id    uuid,
  challenger_name  text,
  opponent_id      uuid,
  opponent_name    text,
  market_id        uuid,
  market_question  text,
  challenger_side  public.trade_side,
  stake            bigint,
  status           text,
  created_at       timestamptz,
  expires_at       timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    d.id,
    d.challenger_id,
    coalesce(pc.display_name, 'Anonymous'),
    d.opponent_id,
    po.display_name,
    d.market_id,
    left(m.question, 120),
    d.challenger_side,
    d.stake,
    d.status,
    d.created_at,
    d.expires_at
  from public.duels d
  join public.markets m on m.id = d.market_id
  left join public.profiles pc on pc.id = d.challenger_id
  left join public.profiles po on po.id = d.opponent_id
  where d.status = 'pending'
    and d.expires_at > now()
    and m.status = 'open'
  order by d.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.get_open_duels(int) from public;
grant  execute on function public.get_open_duels(int) to authenticated;

create or replace function public.get_my_duels(p_limit int default 30)
returns table (
  id               uuid,
  challenger_id    uuid,
  challenger_name  text,
  opponent_id      uuid,
  opponent_name    text,
  market_id        uuid,
  market_question  text,
  challenger_side  public.trade_side,
  opponent_side    public.trade_side,
  stake            bigint,
  status           text,
  winner_id        uuid,
  created_at       timestamptz,
  accepted_at      timestamptz,
  settled_at       timestamptz
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
      d.id,
      d.challenger_id,
      coalesce(pc.display_name, 'Anonymous'),
      d.opponent_id,
      coalesce(po.display_name, 'Anonymous'),
      d.market_id,
      left(m.question, 120),
      d.challenger_side,
      d.opponent_side,
      d.stake,
      d.status,
      d.winner_id,
      d.created_at,
      d.accepted_at,
      d.settled_at
    from public.duels d
    join public.markets m on m.id = d.market_id
    left join public.profiles pc on pc.id = d.challenger_id
    left join public.profiles po on po.id = d.opponent_id
    where d.challenger_id = v_user_id or d.opponent_id = v_user_id
    order by d.created_at desc
    limit greatest(1, least(p_limit, 100));
end;
$$;

revoke execute on function public.get_my_duels(int) from public;
grant  execute on function public.get_my_duels(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('duels_enabled', false, 'Head-to-head prediction duels with VIBE stakes')
on conflict (key) do update set description = excluded.description;

-- Duel win achievements in check_achievements.
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

  return v_count;
end;
$$;
