-- =============================================================================
-- PM-2: Auto-resolve Polymarket mirrors when PM closes
-- Phase 7.5: 1-minute fast slots + user recurring series + creator trade fee
--
-- Requires Phase 7 objects. If migration 20 was skipped, we create them here.
-- =============================================================================

-- Phase 7 prerequisites (safe if migration 20260120000000 already applied)
alter table public.markets
  add column if not exists fast_asset         text,
  add column if not exists fast_interval_sec  int,
  add column if not exists strike_price       numeric,
  add column if not exists resolve_price      numeric,
  add column if not exists window_start       timestamptz,
  add column if not exists window_end         timestamptz,
  add column if not exists creator_bonus_paid boolean not null default false;

create index if not exists markets_fast_open_idx
  on public.markets (fast_asset, fast_interval_sec, window_end)
  where fast_asset is not null and status = 'open';

create table if not exists public.asset_price_ticks (
  id          uuid primary key default gen_random_uuid(),
  asset       text not null,
  price_usd   numeric not null check (price_usd > 0),
  recorded_at timestamptz not null default now()
);

create index if not exists asset_price_ticks_asset_time_idx
  on public.asset_price_ticks (asset, recorded_at desc);

create table if not exists public.fast_market_slots (
  asset          text not null,
  interval_sec   int  not null check (interval_sec between 60 and 3600),
  label          text not null,
  category       public.market_category not null default 'crypto',
  primary key (asset, interval_sec)
);

insert into public.fast_market_slots (asset, interval_sec, label, category) values
  ('btc', 300, 'Bitcoin', 'crypto'),
  ('eth', 300, 'Ethereum', 'crypto'),
  ('sol', 300, 'Solana', 'crypto')
on conflict do nothing;

create or replace function public._guard_fast_market_trade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.markets m
     where m.id = NEW.market_id
       and m.fast_asset is not null
       and m.window_end is not null
       and m.window_end <= now()
  ) then
    raise exception 'Fast market window has ended';
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_fast_market_trade on public.trades;
create trigger guard_fast_market_trade
  before insert on public.trades
  for each row execute function public._guard_fast_market_trade();

insert into public.feature_flags (key, enabled, description)
values (
  'fast_markets_enabled',
  false,
  'Auto-spawned crypto Up/Down interval markets with live price charts'
)
on conflict (key) do update set description = excluded.description;

-- ---------------------------------------------------------------------------
-- PM-2: finalize open mirrors when Polymarket reports closed + decisive odds.
-- p_updates: [{"external_id":"123","closed":true,"yes_price":0.02}, ...]
-- ---------------------------------------------------------------------------
create or replace function public._void_mirror_market_internal(p_market_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id    uuid;
  v_pos      record;
  v_wallet   uuid;
begin
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_void',
    'market_void:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id),
    null
  ) returning id into v_tx_id;

  for v_pos in
    select user_id, total_cost from public.positions
     where market_id = p_market_id and total_cost > 0
  loop
    select id into v_wallet from public.accounts
     where owner_user_id = v_pos.user_id
       and kind = 'user_wallet' and currency = 'vibe';
    if v_wallet is not null then
      insert into public.ledger_entries (transaction_id, account_id, amount, currency)
      values (v_tx_id, v_wallet, v_pos.total_cost, 'vibe');
    end if;
  end loop;

  update public.markets
     set status = 'voided', resolved_at = now()
   where id = p_market_id;
end;
$$;

revoke execute on function public._void_mirror_market_internal(uuid) from public;

create or replace function public.finalize_polymarket_mirrors(p_updates jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item       jsonb;
  v_ext_id     text;
  v_closed     boolean;
  v_yes       numeric;
  v_market_id uuid;
  v_count      int := 0;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    v_ext_id := trim(v_item->>'external_id');
    v_closed := coalesce((v_item->>'closed')::boolean, false);
    v_yes := (v_item->>'yes_price')::numeric;
    if v_ext_id is null or not v_closed then continue; end if;

    select id into v_market_id from public.markets
     where external_id = v_ext_id
       and source = 'polymarket_mirror'
       and status = 'open';

    if v_market_id is null then continue; end if;

    if v_yes is not null and v_yes >= 0.95 then
      perform public.finalize_market_internal(v_market_id, true);
      v_count := v_count + 1;
    elsif v_yes is not null and v_yes <= 0.05 then
      perform public.finalize_market_internal(v_market_id, false);
      v_count := v_count + 1;
    else
      perform public._void_mirror_market_internal(v_market_id);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.finalize_polymarket_mirrors(jsonb) from public;
grant  execute on function public.finalize_polymarket_mirrors(jsonb) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1-minute platform fast slots
-- ---------------------------------------------------------------------------
insert into public.fast_market_slots (asset, interval_sec, label, category) values
  ('btc', 60, 'Bitcoin', 'crypto'),
  ('eth', 60, 'Ethereum', 'crypto'),
  ('sol', 60, 'Solana', 'crypto')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- User recurring series (Up/Down cycles on an asset + interval)
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_market_series (
  id               uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  fast_asset        text not null,
  interval_sec      int not null check (interval_sec between 60 and 3600),
  creator_fee_bps   int not null default 200 check (creator_fee_bps between 0 and 500),
  category         public.market_category not null default 'crypto',
  enabled          boolean not null default true,
  windows_spawned   int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists recurring_series_creator_idx
  on public.recurring_market_series (creator_id);

alter table public.markets
  add column if not exists recurring_series_id uuid references public.recurring_market_series(id) on delete set null,
  add column if not exists creator_fee_bps int not null default 0 check (creator_fee_bps between 0 and 500);

-- ---------------------------------------------------------------------------
-- Spawn fast window (platform or recurring series owner)
-- ---------------------------------------------------------------------------
-- Drop old _spawn_fast_market signature before replacing.
drop function if exists public._spawn_fast_market(
  uuid, text, int, text, public.market_category, numeric, timestamptz, timestamptz
);

create or replace function public._spawn_fast_market(
  p_creator_id       uuid,
  p_asset            text,
  p_interval_sec     int,
  p_label            text,
  p_category         public.market_category,
  p_strike_price     numeric,
  p_window_start     timestamptz,
  p_window_end       timestamptz,
  p_recurring_series_id uuid default null,
  p_creator_fee_bps  int default 0
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id uuid;
  v_interval_label text;
  v_question      text;
  v_source        public.market_source;
begin
  if p_interval_sec < 120 then
    v_interval_label := p_interval_sec::text || ' sec';
  elsif p_interval_sec % 60 = 0 then
    v_interval_label := (p_interval_sec / 60)::text || ' min';
  else
    v_interval_label := p_interval_sec::text || ' sec';
  end if;

  v_question := format(
    '%s Up or Down — %s (%s)',
    p_label,
    v_interval_label,
    to_char(p_window_start at time zone 'UTC', 'Mon DD HH24:MI:SS') || ' UTC'
  );

  v_source := case when p_recurring_series_id is null
    then 'platform'::public.market_source
    else 'community'::public.market_source
  end;

  v_market_id := public._create_platform_market(
    p_creator_id,
    left(v_question, 280),
    format(
      'Resolves Up if %s USD price at window end is >= strike $%s set at window open. '
      'Down otherwise. Auto-resolved — no dispute window. Play-money VIBE only.',
      upper(p_asset),
      round(p_strike_price, 2)
    ),
    5000,
    0.5,
    p_window_end,
    p_category,
    'Up',
    'Down',
    v_source,
    false,
    null, null, null, null, null
  );

  update public.markets
     set fast_asset = p_asset,
         fast_interval_sec = p_interval_sec,
         strike_price = p_strike_price,
         window_start = p_window_start,
         window_end = p_window_end,
         recurring_series_id = p_recurring_series_id,
         creator_fee_bps = coalesce(p_creator_fee_bps, 0)
   where id = v_market_id;

  if p_recurring_series_id is not null then
    update public.recurring_market_series
       set windows_spawned = windows_spawned + 1
     where id = p_recurring_series_id;
  end if;

  return v_market_id;
end;
$$;

revoke execute on function public._spawn_fast_market(
  uuid, text, int, text, public.market_category, numeric, timestamptz, timestamptz, uuid, int
) from public;

-- User creates a recurring Up/Down series (1000 VIBE activation fee).
create or replace function public.create_recurring_series(
  p_title           text,
  p_asset            text,
  p_interval_sec     int,
  p_creator_fee_bps  int default 200
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_wallet    uuid;
  v_balance   bigint;
  v_fee       bigint := 1000;
  v_tx_id     uuid;
  v_mint      uuid;
  v_series_id uuid;
  v_asset     text := lower(trim(p_asset));
  v_label     text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_interval_sec < 60 or p_interval_sec > 3600 then
    raise exception 'interval must be between 60 and 3600 seconds';
  end if;
  if p_creator_fee_bps < 0 or p_creator_fee_bps > 500 then
    raise exception 'creator fee must be 0–500 bps (0–5%%)';
  end if;
  if v_asset not in ('btc', 'eth', 'sol') then
    raise exception 'asset must be btc, eth, or sol for auto-oracle windows';
  end if;

  v_label := case v_asset
    when 'btc' then 'Bitcoin'
    when 'eth' then 'Ethereum'
    when 'sol' then 'Solana'
    else initcap(v_asset)
  end;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then raise exception 'wallet not found'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < v_fee then
    raise exception 'need % VIBE to start a recurring series (have %)', v_fee, v_balance;
  end if;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'platform_mint';
  if v_mint is null then raise exception 'platform mint missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'recurring_series_fee',
    'recurring_series:' || gen_random_uuid()::text,
    jsonb_build_object('asset', v_asset, 'interval_sec', p_interval_sec),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -v_fee, 'vibe'),
    (v_tx_id, v_mint, v_fee, 'vibe');

  insert into public.recurring_market_series (
    creator_id, title, fast_asset, interval_sec, creator_fee_bps
  ) values (
    v_user_id,
    left(coalesce(nullif(trim(p_title), ''), v_label || ' Up/Down'), 120),
    v_asset,
    p_interval_sec,
    coalesce(p_creator_fee_bps, 200)
  ) returning id into v_series_id;

  return v_series_id;
end;
$$;

revoke execute on function public.create_recurring_series(text, text, int, int) from public;
grant  execute on function public.create_recurring_series(text, text, int, int) to authenticated;

-- Patch fast tick: spawn platform slots + enabled recurring series.
create or replace function public.record_fast_market_tick(p_prices jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item          jsonb;
  v_asset         text;
  v_price         numeric;
  v_bot_id        uuid;
  v_market        record;
  v_outcome       boolean;
  v_resolved      int := 0;
  v_spawned       int := 0;
  v_slot          record;
  v_series       record;
  v_has_open      boolean;
begin
  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then
    select id into v_bot_id from auth.users
     where (raw_app_meta_data->>'role') = 'admin'
     order by created_at asc limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb))
  loop
    v_asset := lower(trim(v_item->>'asset'));
    v_price := (v_item->>'price')::numeric;
    if v_asset is null or v_price is null or v_price <= 0 then continue; end if;

    insert into public.asset_price_ticks (asset, price_usd) values (v_asset, v_price);

    for v_market in
      select id, strike_price, window_end
        from public.markets
       where fast_asset = v_asset
         and status = 'open'
         and window_end is not null
         and window_end <= now()
       for update
    loop
      v_outcome := v_price >= v_market.strike_price;
      update public.markets
         set resolve_price = v_price, proposed_outcome = v_outcome
       where id = v_market.id;
      perform public.finalize_market_internal(v_market.id, v_outcome);
      v_resolved := v_resolved + 1;
    end loop;
  end loop;

  delete from public.asset_price_ticks
   where recorded_at < now() - interval '2 hours';

  if v_bot_id is null then
    return jsonb_build_object('resolved', v_resolved, 'spawned', v_spawned);
  end if;

  for v_slot in select * from public.fast_market_slots
  loop
    select exists(
      select 1 from public.markets
       where fast_asset = v_slot.asset
         and fast_interval_sec = v_slot.interval_sec
         and recurring_series_id is null
         and status = 'open'
         and window_end > now()
    ) into v_has_open;

    if not v_has_open then
      select (elem->>'price')::numeric into v_price
        from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) elem
       where lower(trim(elem->>'asset')) = v_slot.asset limit 1;

      if v_price is not null and v_price > 0 then
        perform public._spawn_fast_market(
          v_bot_id, v_slot.asset, v_slot.interval_sec, v_slot.label, v_slot.category,
          v_price, now(), now() + (v_slot.interval_sec || ' seconds')::interval,
          null, 0
        );
        v_spawned := v_spawned + 1;
      end if;
    end if;
  end loop;

  for v_series in
    select * from public.recurring_market_series where enabled = true
  loop
    select exists(
      select 1 from public.markets
       where recurring_series_id = v_series.id
         and status = 'open'
         and window_end > now()
    ) into v_has_open;

    if not v_has_open then
      select (elem->>'price')::numeric into v_price
        from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) elem
       where lower(trim(elem->>'asset')) = v_series.fast_asset limit 1;

      if v_price is not null and v_price > 0 then
        perform public._spawn_fast_market(
          v_series.creator_id,
          v_series.fast_asset,
          v_series.interval_sec,
          initcap(v_series.fast_asset),
          v_series.category,
          v_price,
          now(),
          now() + (v_series.interval_sec || ' seconds')::interval,
          v_series.id,
          v_series.creator_fee_bps
        );
        v_spawned := v_spawned + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('resolved', v_resolved, 'spawned', v_spawned);
end;
$$;

revoke execute on function public.record_fast_market_tick(jsonb) from public;
grant  execute on function public.record_fast_market_tick(jsonb) to authenticated, anon;

-- Creator fee on trades (bps of cost → series owner / market creator).
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
  v_creator_wallet uuid;
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
  v_fee           bigint;
  v_net_cost      bigint;
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
    jsonb_build_object('market_id', p_market_id, 'side', p_side, 'cost', p_cost, 'shares', v_shares, 'creator_fee', v_fee),
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
    reserve_yes_after, reserve_no_after, ledger_transaction_id
  ) values (
    p_market_id, v_user_id, p_side, p_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id
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

  return query select v_trade_id, v_shares, v_yes_after, v_no_after;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values (
  'recurring_series_enabled',
  false,
  'Let users create recurring Up/Down crypto windows with creator fees'
)
on conflict (key) do update set description = excluded.description;

alter table public.recurring_market_series enable row level security;

drop policy if exists recurring_series_select on public.recurring_market_series;
create policy recurring_series_select on public.recurring_market_series
  for select using (enabled = true or creator_id = auth.uid());

drop policy if exists recurring_series_update_own on public.recurring_market_series;
create policy recurring_series_update_own on public.recurring_market_series
  for update using (creator_id = auth.uid());

-- Rebuild markets_view so fast / recurring columns on markets are visible.
drop view if exists public.categorical_market_view;
drop view if exists public.markets_view;

create view public.markets_view
with (security_invoker = true) as
select
  m.*,
  (m.reserve_no::numeric / nullif(m.reserve_yes + m.reserve_no, 0))::numeric as yes_price,
  coalesce((
    select (t.reserve_no_after::numeric
            / nullif(t.reserve_yes_after + t.reserve_no_after, 0))::numeric
    from public.trades t
    where t.market_id = m.id and t.side is not null
      and t.created_at < (now() - interval '24 hours')
    order by t.created_at desc limit 1
  ), 0.5::numeric) as yes_price_24h_ago,
  coalesce((select sum(abs(t.cost))::bigint from public.trades t where t.market_id = m.id), 0)::bigint as volume,
  coalesce((select count(*)::int from public.trades t where t.market_id = m.id), 0)::int as trade_count,
  coalesce((
    select sum(abs(t.cost))::bigint from public.trades t
    where t.market_id = m.id and t.created_at >= (now() - interval '24 hours')
  ), 0)::bigint as volume_24h
from public.markets m;

create view public.categorical_market_view
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
    from public.market_outcomes mo where mo.market_id = m.id
  ), '[]'::jsonb) as outcomes,
  coalesce((select sum(abs(t.cost))::bigint from public.trades t where t.market_id = m.id), 0)::bigint as volume,
  coalesce((select count(*)::int from public.trades t where t.market_id = m.id), 0)::int as trade_count
from public.markets m
where m.kind = 'categorical';
