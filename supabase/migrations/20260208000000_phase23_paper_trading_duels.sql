-- =============================================================================
-- Phase 23: Paper trading duels — live crypto return race, auto-settled
-- =============================================================================

create table if not exists public.paper_duels (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references auth.users(id) on delete cascade,
  opponent_id         uuid references auth.users(id) on delete set null,
  creator_asset       text not null check (creator_asset in ('btc', 'eth', 'sol')),
  opponent_asset      text check (opponent_asset in ('btc', 'eth', 'sol')),
  duration_sec        int not null check (duration_sec in (300, 600, 900)),
  stake               bigint not null check (stake >= 10 and stake <= 100000),
  status              text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'expired')),
  creator_start_price numeric,
  opponent_start_price numeric,
  creator_end_price   numeric,
  opponent_end_price  numeric,
  creator_return_pct  numeric,
  opponent_return_pct numeric,
  winner_id           uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '24 hours'),
  started_at          timestamptz,
  ends_at             timestamptz,
  settled_at          timestamptz,
  constraint paper_duels_different_users check (opponent_id is null or opponent_id <> creator_id)
);

create index if not exists paper_duels_status_ends_idx
  on public.paper_duels (status, ends_at)
  where status = 'active';

create index if not exists paper_duels_open_idx
  on public.paper_duels (status, created_at desc)
  where status = 'open';

alter table public.paper_duels enable row level security;

drop policy if exists paper_duels_select on public.paper_duels;
create policy paper_duels_select on public.paper_duels
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or status = 'open'
    or status = 'active'
  );

-- ---------------------------------------------------------------------------
create or replace function public._paper_duel_escrow_code(p_duel_id uuid)
returns text
language sql
immutable
as $$
  select 'paper_duel_escrow:' || p_duel_id::text;
$$;

create or replace function public._price_from_payload(
  p_prices jsonb,
  p_asset  text
) returns numeric
language sql
immutable
as $$
  select (elem->>'price')::numeric
    from jsonb_array_elements(p_prices) elem
   where lower(elem->>'asset') = lower(p_asset)
   limit 1;
$$;

revoke execute on function public._paper_duel_escrow_code(uuid) from public;

create or replace function public._refund_paper_duel_escrow(
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
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._paper_duel_escrow_code(p_duel_id);
  if v_wallet is null or v_escrow is null then return; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    p_kind,
    p_kind || ':' || p_duel_id::text || ':' || p_user_id::text,
    jsonb_build_object('paper_duel_id', p_duel_id),
    p_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -p_amount, 'vibe'),
    (v_tx_id, v_wallet,  p_amount, 'vibe');
end;
$$;

revoke execute on function public._refund_paper_duel_escrow(uuid, uuid, bigint, text) from public;

create or replace function public.create_paper_duel(
  p_creator_asset text,
  p_duration_sec  int,
  p_stake         bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel_id uuid;
  v_asset   text := lower(trim(p_creator_asset));
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if v_asset not in ('btc', 'eth', 'sol') then raise exception 'asset must be btc, eth, or sol'; end if;
  if p_duration_sec not in (300, 600, 900) then raise exception 'duration must be 5, 10, or 15 minutes'; end if;
  if p_stake < 10 or p_stake > 100000 then raise exception 'stake must be 10–100,000 VIBE'; end if;

  insert into public.paper_duels (creator_id, creator_asset, duration_sec, stake)
  values (v_user_id, v_asset, p_duration_sec, p_stake)
  returning id into v_duel_id;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    p_stake,
    'paper_duel_create',
    'paper_duel_create:' || v_duel_id::text,
    public._paper_duel_escrow_code(v_duel_id),
    jsonb_build_object('paper_duel_id', v_duel_id, 'asset', v_asset)
  );

  return v_duel_id;
end;
$$;

revoke execute on function public.create_paper_duel(text, int, bigint) from public;
grant  execute on function public.create_paper_duel(text, int, bigint) to authenticated;

create or replace function public.accept_paper_duel(
  p_duel_id       uuid,
  p_opponent_asset text,
  p_start_prices  jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_duel          public.paper_duels%rowtype;
  v_asset         text := lower(trim(p_opponent_asset));
  v_creator_start numeric;
  v_opponent_start numeric;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if v_asset not in ('btc', 'eth', 'sol') then raise exception 'asset must be btc, eth, or sol'; end if;

  select * into v_duel from public.paper_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel is not open'; end if;
  if v_duel.expires_at <= now() then raise exception 'duel expired'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot join your own duel'; end if;

  v_creator_start := public._price_from_payload(p_start_prices, v_duel.creator_asset);
  v_opponent_start := public._price_from_payload(p_start_prices, v_asset);
  if v_creator_start is null or v_creator_start <= 0 then
    raise exception 'missing start price for %', v_duel.creator_asset;
  end if;
  if v_opponent_start is null or v_opponent_start <= 0 then
    raise exception 'missing start price for %', v_asset;
  end if;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    v_duel.stake,
    'paper_duel_accept',
    'paper_duel_accept:' || p_duel_id::text,
    public._paper_duel_escrow_code(p_duel_id),
    jsonb_build_object('paper_duel_id', p_duel_id, 'asset', v_asset)
  );

  update public.paper_duels
     set status = 'active',
         opponent_id = v_user_id,
         opponent_asset = v_asset,
         creator_start_price = v_creator_start,
         opponent_start_price = v_opponent_start,
         started_at = now(),
         ends_at = now() + make_interval(secs => v_duel.duration_sec)
   where id = p_duel_id;
end;
$$;

revoke execute on function public.accept_paper_duel(uuid, text, jsonb) from public;
grant  execute on function public.accept_paper_duel(uuid, text, jsonb) to authenticated;

create or replace function public.cancel_paper_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.paper_duels%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.paper_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.creator_id <> v_user_id then raise exception 'only creator can cancel'; end if;
  if v_duel.status <> 'open' then raise exception 'can only cancel open duels'; end if;

  perform public._refund_paper_duel_escrow(
    p_duel_id, v_duel.creator_id, v_duel.stake, 'paper_duel_cancel'
  );

  update public.paper_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

revoke execute on function public.cancel_paper_duel(uuid) from public;
grant  execute on function public.cancel_paper_duel(uuid) to authenticated;

create or replace function public._settle_paper_duel(
  p_duel_id uuid,
  p_end_prices jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel            public.paper_duels%rowtype;
  v_creator_end     numeric;
  v_opponent_end    numeric;
  v_creator_ret     numeric;
  v_opponent_ret    numeric;
  v_winner          uuid;
  v_wallet          uuid;
  v_escrow          uuid;
  v_tx_id           uuid;
  v_pool            bigint;
begin
  select * into v_duel from public.paper_duels where id = p_duel_id for update;
  if not found or v_duel.status <> 'active' then return; end if;
  if v_duel.ends_at > now() then return; end if;

  v_creator_end := public._price_from_payload(p_end_prices, v_duel.creator_asset);
  v_opponent_end := public._price_from_payload(p_end_prices, v_duel.opponent_asset);
  if v_creator_end is null or v_opponent_end is null then return; end if;

  v_creator_ret := ((v_creator_end - v_duel.creator_start_price) / v_duel.creator_start_price) * 100;
  v_opponent_ret := ((v_opponent_end - v_duel.opponent_start_price) / v_duel.opponent_start_price) * 100;

  if v_creator_ret > v_opponent_ret then
    v_winner := v_duel.creator_id;
  elsif v_opponent_ret > v_creator_ret then
    v_winner := v_duel.opponent_id;
  else
    v_winner := null;
  end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._paper_duel_escrow_code(p_duel_id);

  v_pool := v_duel.stake * 2;

  if v_escrow is not null then
    if v_winner is not null then
      select public._wallet_for_user(v_winner) into v_wallet;
      if v_wallet is not null then
        insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
        values (
          'paper_duel_settle',
          'paper_duel_settle:' || p_duel_id::text,
          jsonb_build_object(
            'paper_duel_id', p_duel_id,
            'winner_id', v_winner,
            'creator_return_pct', v_creator_ret,
            'opponent_return_pct', v_opponent_ret
          ),
          null
        ) returning id into v_tx_id;

        insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
          (v_tx_id, v_escrow, -v_pool, 'vibe'),
          (v_tx_id, v_wallet, v_pool, 'vibe');
      end if;
    else
      -- Tie: refund both players their stake.
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values (
        'paper_duel_tie',
        'paper_duel_tie:' || p_duel_id::text,
        jsonb_build_object('paper_duel_id', p_duel_id),
        null
      ) returning id into v_tx_id;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      select v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'
       where public._wallet_for_user(v_duel.creator_id) is not null;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      select v_tx_id, public._wallet_for_user(v_duel.opponent_id), v_duel.stake, 'vibe'
       where public._wallet_for_user(v_duel.opponent_id) is not null;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      values (v_tx_id, v_escrow, -v_pool, 'vibe');
    end if;
  end if;

  update public.paper_duels
     set status = 'settled',
         winner_id = v_winner,
         creator_end_price = v_creator_end,
         opponent_end_price = v_opponent_end,
         creator_return_pct = v_creator_ret,
         opponent_return_pct = v_opponent_ret,
         settled_at = now()
   where id = p_duel_id;
end;
$$;

revoke execute on function public._settle_paper_duel(uuid, jsonb) from public;

create or replace function public.paper_duel_tick(p_prices jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel record;
  v_settled int := 0;
  v_expired int := 0;
begin
  for v_duel in
    select id from public.paper_duels
     where status = 'active' and ends_at <= now()
     for update skip locked
  loop
    perform public._settle_paper_duel(v_duel.id, p_prices);
    v_settled := v_settled + 1;
  end loop;

  for v_duel in
    select id, creator_id, stake from public.paper_duels
     where status = 'open' and expires_at <= now()
     for update
  loop
    perform public._refund_paper_duel_escrow(v_duel.id, v_duel.creator_id, v_duel.stake, 'paper_duel_expired');
    update public.paper_duels set status = 'expired' where id = v_duel.id;
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('settled', v_settled, 'expired', v_expired);
end;
$$;

revoke execute on function public.paper_duel_tick(jsonb) from public;
grant  execute on function public.paper_duel_tick(jsonb) to authenticated;

create or replace function public.get_open_paper_duels(p_limit int default 20)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  creator_asset   text,
  duration_sec    int,
  stake           bigint,
  created_at      timestamptz,
  expires_at      timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    d.id,
    d.creator_id,
    coalesce(p.display_name, 'Anonymous'),
    d.creator_asset,
    d.duration_sec,
    d.stake,
    d.created_at,
    d.expires_at
  from public.paper_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open'
    and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.get_open_paper_duels(int) from public;
grant  execute on function public.get_open_paper_duels(int) to authenticated;

create or replace function public.get_active_paper_duels(p_limit int default 15)
returns table (
  id                    uuid,
  creator_name          text,
  opponent_name         text,
  creator_asset         text,
  opponent_asset        text,
  duration_sec          int,
  stake                 bigint,
  creator_start_price   numeric,
  opponent_start_price  numeric,
  creator_return_pct    numeric,
  opponent_return_pct   numeric,
  started_at            timestamptz,
  ends_at               timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    d.id,
    coalesce(pc.display_name, 'Anonymous'),
    coalesce(po.display_name, 'Anonymous'),
    d.creator_asset,
    d.opponent_asset,
    d.duration_sec,
    d.stake,
    d.creator_start_price,
    d.opponent_start_price,
    d.creator_return_pct,
    d.opponent_return_pct,
    d.started_at,
    d.ends_at
  from public.paper_duels d
  left join public.profiles pc on pc.id = d.creator_id
  left join public.profiles po on po.id = d.opponent_id
  where d.status = 'active'
  order by d.ends_at asc
  limit greatest(1, least(p_limit, 30));
$$;

revoke execute on function public.get_active_paper_duels(int) from public;
grant  execute on function public.get_active_paper_duels(int) to authenticated, anon;

create or replace function public.get_my_paper_duels(p_limit int default 25)
returns table (
  id                    uuid,
  creator_id            uuid,
  creator_name          text,
  opponent_id           uuid,
  opponent_name         text,
  creator_asset         text,
  opponent_asset        text,
  duration_sec          int,
  stake                 bigint,
  status                text,
  creator_return_pct    numeric,
  opponent_return_pct   numeric,
  winner_id             uuid,
  created_at            timestamptz,
  started_at            timestamptz,
  ends_at               timestamptz,
  settled_at            timestamptz
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
      d.creator_id,
      coalesce(pc.display_name, 'Anonymous'),
      d.opponent_id,
      coalesce(po.display_name, 'Anonymous'),
      d.creator_asset,
      d.opponent_asset,
      d.duration_sec,
      d.stake,
      d.status,
      d.creator_return_pct,
      d.opponent_return_pct,
      d.winner_id,
      d.created_at,
      d.started_at,
      d.ends_at,
      d.settled_at
    from public.paper_duels d
    left join public.profiles pc on pc.id = d.creator_id
    left join public.profiles po on po.id = d.opponent_id
    where d.creator_id = v_user_id or d.opponent_id = v_user_id
    order by d.created_at desc
    limit greatest(1, least(p_limit, 50));
end;
$$;

revoke execute on function public.get_my_paper_duels(int) from public;
grant  execute on function public.get_my_paper_duels(int) to authenticated;

create or replace function public.get_paper_duel(p_duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_duel public.paper_duels%rowtype;
  v_creator_name text;
  v_opponent_name text;
begin
  select * into v_duel from public.paper_duels where id = p_duel_id;
  if not found then return null; end if;

  select coalesce(display_name, 'Anonymous') into v_creator_name
    from public.profiles where id = v_duel.creator_id;
  select coalesce(display_name, 'Anonymous') into v_opponent_name
    from public.profiles where id = v_duel.opponent_id;

  return jsonb_build_object(
    'id', v_duel.id,
    'creator_id', v_duel.creator_id,
    'creator_name', v_creator_name,
    'opponent_id', v_duel.opponent_id,
    'opponent_name', v_opponent_name,
    'creator_asset', v_duel.creator_asset,
    'opponent_asset', v_duel.opponent_asset,
    'duration_sec', v_duel.duration_sec,
    'stake', v_duel.stake,
    'status', v_duel.status,
    'creator_start_price', v_duel.creator_start_price,
    'opponent_start_price', v_duel.opponent_start_price,
    'creator_end_price', v_duel.creator_end_price,
    'opponent_end_price', v_duel.opponent_end_price,
    'creator_return_pct', v_duel.creator_return_pct,
    'opponent_return_pct', v_duel.opponent_return_pct,
    'winner_id', v_duel.winner_id,
    'started_at', v_duel.started_at,
    'ends_at', v_duel.ends_at,
    'settled_at', v_duel.settled_at
  );
end;
$$;

revoke execute on function public.get_paper_duel(uuid) from public;
grant  execute on function public.get_paper_duel(uuid) to authenticated, anon;

insert into public.feature_flags (key, enabled, description)
values ('paper_trading_duels_enabled', false, 'Paper trading return races on live crypto (5–15 min)')
on conflict (key) do update set description = excluded.description;
