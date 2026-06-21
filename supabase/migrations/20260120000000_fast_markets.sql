-- =============================================================================
-- Phase 7: Fast markets (crypto Up/Down windows)
-- =============================================================================
-- Auto-spawned interval markets (e.g. BTC Up or Down — 5m) with strike price
-- at window open. Resolves automatically when window ends (no court).
-- Price ticks stored for live charts.
-- =============================================================================

alter table public.markets
  add column if not exists fast_asset         text,
  add column if not exists fast_interval_sec  int,
  add column if not exists strike_price       numeric,
  add column if not exists resolve_price      numeric,
  add column if not exists window_start       timestamptz,
  add column if not exists window_end         timestamptz;

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

-- Slots the ticker maintains (asset + interval seconds).
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

-- ---------------------------------------------------------------------------
-- Internal: spawn one fast market for a slot at the given strike price.
-- ---------------------------------------------------------------------------
create or replace function public._spawn_fast_market(
  p_bot_id        uuid,
  p_asset         text,
  p_interval_sec  int,
  p_label         text,
  p_category      public.market_category,
  p_strike_price  numeric,
  p_window_start  timestamptz,
  p_window_end    timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id uuid;
  v_question  text;
  v_mins      int;
begin
  v_mins := greatest(1, p_interval_sec / 60);
  v_question := format(
    '%s Up or Down — %s min (%s)',
    p_label,
    v_mins,
    to_char(p_window_start at time zone 'UTC', 'Mon DD HH24:MI') || ' UTC'
  );

  v_market_id := public._create_platform_market(
    p_bot_id,
    left(v_question, 280),
    format(
      'Resolves Up if %s USD price at window end is >= strike price $%s set at window open. '
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
    'platform'::public.market_source,
    false,
    null, null, null, null, null
  );

  update public.markets
     set fast_asset = p_asset,
         fast_interval_sec = p_interval_sec,
         strike_price = p_strike_price,
         window_start = p_window_start,
         window_end = p_window_end
   where id = v_market_id;

  return v_market_id;
end;
$$;

revoke execute on function public._spawn_fast_market(uuid, text, int, text, public.market_category, numeric, timestamptz, timestamptz) from public;

-- ---------------------------------------------------------------------------
-- Resolve expired fast markets, spawn new ones, record price ticks.
-- p_prices: [{"asset":"btc","price":62464.30}, ...]
-- ---------------------------------------------------------------------------
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

    insert into public.asset_price_ticks (asset, price_usd)
    values (v_asset, v_price);

    -- Resolve expired windows for this asset.
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
         set resolve_price = v_price,
             proposed_outcome = v_outcome
       where id = v_market.id;
      perform public.finalize_market_internal(v_market.id, v_outcome);
      v_resolved := v_resolved + 1;
    end loop;
  end loop;

  -- Prune old ticks (keep ~2 hours per asset).
  delete from public.asset_price_ticks
   where recorded_at < now() - interval '2 hours';

  if v_bot_id is null then
    return jsonb_build_object('resolved', v_resolved, 'spawned', v_spawned);
  end if;

  -- Spawn missing open markets per slot.
  for v_slot in select * from public.fast_market_slots
  loop
    select exists(
      select 1 from public.markets
       where fast_asset = v_slot.asset
         and fast_interval_sec = v_slot.interval_sec
         and status = 'open'
         and window_end > now()
    ) into v_has_open;

    if not v_has_open then
      select (elem->>'price')::numeric into v_price
        from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) elem
       where lower(trim(elem->>'asset')) = v_slot.asset
       limit 1;

      if v_price is not null and v_price > 0 then
        perform public._spawn_fast_market(
          v_bot_id,
          v_slot.asset,
          v_slot.interval_sec,
          v_slot.label,
          v_slot.category,
          v_price,
          now(),
          now() + (v_slot.interval_sec || ' seconds')::interval
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

-- Use a BEFORE trigger on trades to block bets after window end.
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

-- Feature flag seed
insert into public.feature_flags (key, enabled, description)
values (
  'fast_markets_enabled',
  false,
  'Auto-spawned crypto Up/Down interval markets with live price charts'
)
on conflict (key) do update
  set description = excluded.description;

-- Creator volume bonus (community markets) — Phase 7.5 hook
alter table public.markets
  add column if not exists creator_bonus_paid boolean not null default false;

create or replace function public.maybe_grant_creator_bonus(p_market_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market   public.markets%rowtype;
  v_volume   bigint;
  v_bonus    bigint := 500;
  v_wallet   uuid;
  v_tx_id    uuid;
  v_mint     uuid;
begin
  select * into v_market from public.markets where id = p_market_id;
  if not found or v_market.source <> 'community' or v_market.creator_bonus_paid then
    return false;
  end if;

  select coalesce(sum(abs(cost)), 0) into v_volume
    from public.trades where market_id = p_market_id;

  if v_volume < 5000 then return false; end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_market.creator_id
     and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then return false; end if;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'platform_mint';
  if v_mint is null then return false; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'creator_bonus',
    'creator_bonus:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id, 'volume', v_volume),
    null
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, v_bonus, 'vibe'),
    (v_tx_id, v_mint, -v_bonus, 'vibe');

  update public.markets set creator_bonus_paid = true where id = p_market_id;
  return true;
end;
$$;

revoke execute on function public.maybe_grant_creator_bonus(uuid) from public;
grant  execute on function public.maybe_grant_creator_bonus(uuid) to authenticated, anon;
