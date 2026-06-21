-- =============================================================================
-- Phase 4.6: Platform activity bot + rate-limited Polymarket refresh
-- =============================================================================
-- Makes official / mirror markets feel alive without fake user accounts in the UI:
--
--   1. platform_activity_tick() — synthetic VIBE trades from a hidden platform bot
--      wallet (minted from system_mint). Updates reserves, trades, charts.
--   2. refresh_polymarket_mirrors() — batch odds sync (callable from server,
--      rate-limited to once per 15 minutes).
--
-- Setup (one-time, as admin):
--   1. Sign up a dedicated bot account (e.g. platform-bot@yourdomain.com)
--   2. Admin → /admin → paste bot UUID → "Register platform bot"
--   3. Activity + mirror sync run automatically on page loads.
-- =============================================================================

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- No client policies — SECURITY DEFINER RPCs only.

-- -----------------------------------------------------------------------------
-- Internal: place_trade for an arbitrary user (used by bot + future cron).
-- Mirrors place_trade but takes p_user_id instead of auth.uid().
-- -----------------------------------------------------------------------------
create or replace function public.place_trade_for_user(
  p_market_id uuid,
  p_user_id   uuid,
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
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;

  select * into v_market from public.markets
   where id = p_market_id for update;
  if not found then raise exception 'market not found'; end if;
  if v_market.status <> 'open' then raise exception 'market not open'; end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'market closed';
  end if;
  if v_market.kind <> 'binary' then
    raise exception 'only binary markets supported';
  end if;

  select id into v_user_wallet
    from public.accounts
   where owner_user_id = p_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'trader wallet not found'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < p_cost then
    raise exception 'insufficient balance';
  end if;

  select id into v_market_pool
    from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;
  if v_market_pool is null then raise exception 'market pool missing'; end if;

  if p_side = 'yes' then
    v_reserve_in  := v_market.reserve_yes;
    v_reserve_out := v_market.reserve_no;
  else
    v_reserve_in  := v_market.reserve_no;
    v_reserve_out := v_market.reserve_yes;
  end if;

  v_k      := v_reserve_in::numeric * v_reserve_out::numeric;
  v_shares := floor(v_reserve_in + p_cost - v_k / (v_reserve_out + p_cost))::bigint;
  if v_shares <= 0 then raise exception 'shares non-positive'; end if;

  v_new_in  := v_reserve_in + p_cost - v_shares;
  v_new_out := v_reserve_out + p_cost;

  if p_side = 'yes' then
    v_yes_after := v_new_in; v_no_after := v_new_out;
  else
    v_yes_after := v_new_out; v_no_after := v_new_in;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_trade',
    'market_trade:' || gen_random_uuid()::text,
    jsonb_build_object(
      'market_id', p_market_id, 'side', p_side,
      'cost', p_cost, 'shares', v_shares,
      'synthetic', true
    ),
    p_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_cost, 'vibe'),
    (v_tx_id, v_market_pool,   p_cost, 'vibe');

  update public.markets
     set reserve_yes = v_yes_after, reserve_no = v_no_after
   where id = p_market_id;

  insert into public.trades (
    market_id, user_id, side, cost, shares,
    reserve_yes_after, reserve_no_after, ledger_transaction_id
  ) values (
    p_market_id, p_user_id, p_side, p_cost, v_shares,
    v_yes_after, v_no_after, v_tx_id
  )
  returning id into v_trade_id;

  insert into public.positions (market_id, user_id, yes_shares, no_shares, total_cost)
  values (
    p_market_id, p_user_id,
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

revoke execute on function public.place_trade_for_user(uuid, uuid, public.trade_side, bigint) from public;

-- -----------------------------------------------------------------------------
-- RPC: register_platform_bot
--   Admin stores the UUID of the dedicated bot auth.users row.
-- -----------------------------------------------------------------------------
create or replace function public.register_platform_bot(p_bot_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if not exists (select 1 from auth.users where id = p_bot_user_id) then
    raise exception 'user not found';
  end if;

  insert into public.app_config (key, value, updated_at)
  values ('platform_bot_user_id', to_jsonb(p_bot_user_id::text), now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();

  -- Ensure bot has profile + wallets (signup trigger should have run).
  insert into public.profiles (id, display_name)
  values (p_bot_user_id, 'Platform Bot')
  on conflict (id) do update set display_name = 'Platform Bot';
end;
$$;

revoke execute on function public.register_platform_bot(uuid) from public;
grant  execute on function public.register_platform_bot(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Internal: top up platform bot wallet from system_mint (capped per call).
-- -----------------------------------------------------------------------------
create or replace function public._fund_platform_bot(p_amount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bot_id      uuid;
  v_wallet      uuid;
  v_mint        uuid;
  v_tx_id       uuid;
  v_balance     bigint;
begin
  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then return; end if;

  select id into v_wallet
    from public.accounts
   where owner_user_id = v_bot_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then return; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance >= 2000 then return; end if;

  select id into v_mint
    from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then
    insert into public.accounts (kind, currency, code)
    values ('system_mint', 'vibe', 'vibe_mint')
    returning id into v_mint;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'platform_bot_fund',
    'platform_bot_fund:' || gen_random_uuid()::text,
    jsonb_build_object('amount', p_amount, 'bot_id', v_bot_id),
    null
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_mint,   -p_amount, 'vibe'),
    (v_tx_id, v_wallet,  p_amount, 'vibe');
end;
$$;

revoke execute on function public._fund_platform_bot(bigint) from public;

-- -----------------------------------------------------------------------------
-- RPC: platform_activity_tick
--   Opportunistic synthetic trades on platform + mirror markets. Idempotent-ish.
--   Callable by anyone (like court_tick). Swallows errors per market.
-- -----------------------------------------------------------------------------
create or replace function public.platform_activity_tick(p_limit int default 5)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bot_id   uuid;
  v_market   record;
  v_count    int := 0;
  v_side     public.trade_side;
  v_cost     bigint;
  v_yes_pct numeric;
  v_roll    numeric;
begin
  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then return 0; end if;

  perform public._fund_platform_bot(5000);

  for v_market in
    select m.id, m.reserve_yes, m.reserve_no
      from public.markets m
      left join lateral (
        select count(*)::int as trade_count
          from public.trades t where t.market_id = m.id
      ) tc on true
     where m.status = 'open'
       and m.kind = 'binary'
       and (
         m.source in ('platform', 'polymarket_mirror')
         or (m.source = 'community' and coalesce(tc.trade_count, 0) < 5)
       )
     order by random()
     limit greatest(1, least(p_limit, 20))
  loop
    begin
      v_yes_pct := v_market.reserve_no::numeric
        / nullif(v_market.reserve_yes + v_market.reserve_no, 0);
      v_roll := random();
      -- Slight bias toward buying the underdog side (more interesting price action).
      if v_roll < 0.5 then
        v_side := case when v_yes_pct < 0.5 then 'yes' else 'no' end;
      else
        v_side := case when random() < 0.5 then 'yes' else 'no' end;
      end if;

      v_cost := (15 + floor(random() * 66))::bigint;  -- 15–80 VIBE

      perform public.place_trade_for_user(v_market.id, v_bot_id, v_side, v_cost);
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.platform_activity_tick(int) from public;
grant  execute on function public.platform_activity_tick(int) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- RPC: refresh_polymarket_mirrors
--   Batch upsert from server-fetched JSON. Rate-limited to 1 call / 15 min.
--   No admin JWT required — safe because it only touches mirror markets by
--   external_id and cannot create community markets.
--
--   p_payload format: jsonb array of {
--     external_id, question, description, yes_price, closes_at, category,
--     yes_label, no_label, external_url, external_vol, external_vol_24h, image_url
--   }
-- -----------------------------------------------------------------------------
create or replace function public.refresh_polymarket_mirrors(p_payload jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last       timestamptz;
  v_item       jsonb;
  v_count      int := 0;
  v_admin_id   uuid;
  v_market_id  uuid;
begin
  select (value #>> '{}')::timestamptz into v_last
    from public.app_config where key = 'polymarket_last_sync';
  if v_last is not null and v_last > now() - interval '15 minutes' then
    return 0;
  end if;

  -- Use platform bot or first admin as creator for new mirrors.
  select (value #>> '{}')::uuid into v_admin_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_admin_id is null then
    select id into v_admin_id from auth.users
     where (raw_app_meta_data->>'role') = 'admin'
     order by created_at asc limit 1;
  end if;
  if v_admin_id is null then return 0; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb))
  loop
    begin
      v_market_id := public._upsert_polymarket_mirror_internal(
        v_admin_id,
        v_item->>'external_id',
        left(v_item->>'question', 280),
        left(coalesce(v_item->>'description', ''), 2000),
        (v_item->>'yes_price')::numeric,
        nullif(v_item->>'closes_at', '')::timestamptz,
        coalesce(v_item->>'category', 'other'),
        coalesce(v_item->>'yes_label', 'Yes'),
        coalesce(v_item->>'no_label', 'No'),
        v_item->>'external_url',
        nullif(v_item->>'external_vol', '')::numeric,
        nullif(v_item->>'external_vol_24h', '')::numeric,
        v_item->>'image_url'
      );
      if v_market_id is not null then v_count := v_count + 1; end if;
    exception when others then
      null;
    end;
  end loop;

  insert into public.app_config (key, value, updated_at)
  values ('polymarket_last_sync', to_jsonb(now()::text), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return v_count;
end;
$$;

revoke execute on function public.refresh_polymarket_mirrors(jsonb) from public;
grant  execute on function public.refresh_polymarket_mirrors(jsonb) to authenticated, anon;

-- Internal upsert (no admin check — caller must be trusted SECURITY DEFINER).
create or replace function public._upsert_polymarket_mirror_internal(
  p_creator_id       uuid,
  p_external_id      text,
  p_question         text,
  p_description      text,
  p_yes_price        numeric,
  p_closes_at        timestamptz,
  p_category         text,
  p_yes_label        text,
  p_no_label         text,
  p_external_url     text,
  p_external_vol     numeric,
  p_external_vol_24h numeric,
  p_image_url        text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id  uuid;
  v_cat        public.market_category;
  v_res_yes    bigint;
  v_res_no     bigint;
  v_subsidy    bigint := 5000;
  v_pool_total bigint := v_subsidy * 2;
begin
  if p_external_id is null or length(trim(p_external_id)) = 0 then
    raise exception 'external_id required';
  end if;

  v_cat := case p_category
    when 'politics' then 'politics'::public.market_category
    when 'sports' then 'sports'::public.market_category
    when 'crypto' then 'crypto'::public.market_category
    when 'tech' then 'tech'::public.market_category
    when 'entertainment' then 'entertainment'::public.market_category
    when 'finance' then 'finance'::public.market_category
    when 'world' then 'world'::public.market_category
    when 'culture' then 'culture'::public.market_category
    else 'other'::public.market_category
  end;

  select id into v_market_id from public.markets where external_id = p_external_id;

  select r.reserve_yes, r.reserve_no into v_res_yes, v_res_no
    from public.cpmm_reserves_for_yes_price(v_pool_total, p_yes_price) r;

  if v_market_id is null then
    v_market_id := public._create_platform_market(
      p_creator_id,
      left(p_question, 280),
      left(coalesce(p_description, ''), 2000),
      v_subsidy, p_yes_price, p_closes_at, v_cat,
      coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
      coalesce(nullif(trim(p_no_label), ''), 'No'),
      'polymarket_mirror'::public.market_source,
      false, p_external_id, p_external_url,
      p_external_vol, p_external_vol_24h, p_image_url
    );
  else
    update public.markets
       set question = left(p_question, 280),
           description = left(coalesce(p_description, ''), 2000),
           reserve_yes = v_res_yes, reserve_no = v_res_no,
           closes_at = coalesce(p_closes_at, closes_at),
           category = v_cat,
           outcome_yes_label = coalesce(nullif(trim(p_yes_label), ''), outcome_yes_label),
           outcome_no_label = coalesce(nullif(trim(p_no_label), ''), outcome_no_label),
           image_url = coalesce(p_image_url, image_url),
           external_url = p_external_url,
           external_volume_usd = p_external_vol,
           external_volume_24h_usd = p_external_vol_24h,
           external_synced_at = now()
     where id = v_market_id;
  end if;

  return v_market_id;
end;
$$;

revoke execute on function public._upsert_polymarket_mirror_internal(uuid, text, text, text, numeric, timestamptz, text, text, text, text, numeric, numeric, text) from public;

-- Patch admin upsert to delegate to internal helper.
create or replace function public.upsert_polymarket_mirror(
  p_external_id      text,
  p_question         text,
  p_description      text,
  p_yes_price        numeric,
  p_closes_at        timestamptz,
  p_category         text,
  p_yes_label        text,
  p_no_label         text,
  p_external_url     text,
  p_external_vol     numeric,
  p_external_vol_24h numeric,
  p_image_url        text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if auth.uid() is null then raise exception 'unauthenticated'; end if;

  return public._upsert_polymarket_mirror_internal(
    auth.uid(),
    p_external_id, p_question, p_description, p_yes_price, p_closes_at,
    p_category, p_yes_label, p_no_label, p_external_url,
    p_external_vol, p_external_vol_24h, p_image_url
  );
end;
$$;
