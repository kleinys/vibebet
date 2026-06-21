-- =============================================================================
-- Phase 4.5: Official markets + Polymarket mirror support
-- =============================================================================
-- Adds market "source" so we can show three slices in the UI:
--   platform           — Vibebet-curated official markets (seeded, featured)
--   community          — user-created via /markets/new (default)
--   polymarket_mirror  — synced from Polymarket gamma API (play-money clone)
--
-- Platform / mirror markets are funded from system_mint (not admin wallet).
-- Mirror markets store external odds + volume for display; reserves are tuned
-- to match Polymarket yes_price so our cards show similar percentages.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'market_source') then
    create type public.market_source as enum (
      'platform',
      'community',
      'polymarket_mirror'
    );
  end if;
end$$;

alter table public.markets
  add column if not exists source                 public.market_source not null default 'community',
  add column if not exists external_id            text,
  add column if not exists external_url           text,
  add column if not exists external_volume_usd    numeric,
  add column if not exists external_volume_24h_usd numeric,
  add column if not exists external_synced_at      timestamptz;

create unique index if not exists markets_external_id_unique
  on public.markets (external_id)
  where external_id is not null;

create index if not exists markets_source_status_idx
  on public.markets (source, status);

-- -----------------------------------------------------------------------------
-- Helper: CPMM reserves matching a target yes probability.
-- yes_price = reserve_no / (reserve_yes + reserve_no)
-- -----------------------------------------------------------------------------
create or replace function public.cpmm_reserves_for_yes_price(
  p_pool_total bigint,
  p_yes_price  numeric
) returns table (reserve_yes bigint, reserve_no bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_yes numeric := greatest(0.01, least(0.99, coalesce(p_yes_price, 0.5)));
begin
  reserve_no  := greatest(1, round(p_pool_total * v_yes))::bigint;
  reserve_yes := greatest(1, p_pool_total - reserve_no);
  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal: create a platform-funded binary market (no user wallet debit).
-- -----------------------------------------------------------------------------
create or replace function public._create_platform_market(
  p_creator_id       uuid,
  p_question         text,
  p_description      text,
  p_subsidy          bigint,
  p_yes_price        numeric,
  p_closes_at        timestamptz,
  p_category         public.market_category,
  p_yes_label        text,
  p_no_label         text,
  p_source           public.market_source,
  p_is_featured      boolean,
  p_external_id      text,
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
  v_market_id   uuid;
  v_pool        uuid;
  v_mint        uuid;
  v_tx_id       uuid;
  v_res_yes     bigint;
  v_res_no      bigint;
  v_pool_total  bigint := p_subsidy * 2;
begin
  select r.reserve_yes, r.reserve_no
    into v_res_yes, v_res_no
    from public.cpmm_reserves_for_yes_price(v_pool_total, p_yes_price) r;

  insert into public.markets (
    creator_id, question, description, subsidy,
    reserve_yes, reserve_no, closes_at,
    category, image_url, is_featured,
    outcome_yes_label, outcome_no_label,
    kind, source,
    external_id, external_url,
    external_volume_usd, external_volume_24h_usd, external_synced_at
  ) values (
    p_creator_id, p_question, nullif(trim(p_description), ''), p_subsidy,
    v_res_yes, v_res_no, p_closes_at,
    p_category, p_image_url, p_is_featured,
    coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
    coalesce(nullif(trim(p_no_label), ''), 'No'),
    'binary', p_source,
    p_external_id, p_external_url,
    p_external_vol, p_external_vol_24h,
    case when p_source = 'polymarket_mirror' then now() else null end
  )
  returning id into v_market_id;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'market_pool:' || v_market_id::text)
  returning id into v_pool;

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
    'platform_market_seed',
    'platform_market_seed:' || v_market_id::text,
    jsonb_build_object(
      'market_id', v_market_id,
      'source', p_source,
      'subsidy', p_subsidy,
      'yes_price', p_yes_price
    ),
    p_creator_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_mint,  -p_subsidy, 'vibe'),
    (v_tx_id, v_pool,   p_subsidy, 'vibe');

  return v_market_id;
end;
$$;

revoke execute on function public._create_platform_market(uuid, text, text, bigint, numeric, timestamptz, public.market_category, text, text, public.market_source, boolean, text, text, numeric, numeric, text) from public;

-- -----------------------------------------------------------------------------
-- RPC: admin_seed_official_markets
--   Idempotent via question text. Admin-only. Creates ~12 curated markets.
-- -----------------------------------------------------------------------------
create or replace function public.admin_seed_official_markets()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin   uuid := auth.uid();
  v_is_admin boolean;
  v_count   int := 0;
  v_seed    record;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if v_admin is null then raise exception 'unauthenticated'; end if;

  for v_seed in
    select * from (values
      ('Will Bitcoin exceed $150k before Jan 1, 2027?'::text,
       'crypto'::public.market_category, 0.42::numeric, 5000::bigint,
       'Above $150k'::text, 'Below $150k'::text, true),
      ('Will the Fed cut rates at least twice in 2026?',
       'finance', 0.58, 4000, 'Yes', 'No', true),
      ('Will SpaceX Starship reach orbit successfully in 2026?',
       'tech', 0.72, 3500, 'Yes', 'No', false),
      ('Will a major AI lab release GPT-5 or equivalent in 2026?',
       'tech', 0.65, 4500, 'Yes', 'No', true),
      ('Will Ethereum flip Bitcoin market cap in 2026?',
       'crypto', 0.08, 3000, 'Yes', 'No', false),
      ('US recession declared before 2027?',
       'finance', 0.22, 4000, 'Yes', 'No', false),
      ('Will Ukraine and Russia agree to a ceasefire in 2026?',
       'world', 0.35, 5000, 'Yes', 'No', true),
      ('Will Trump win the 2028 US presidential election?',
       'politics', 0.48, 6000, 'Yes', 'No', true),
      ('Will Apple announce a foldable iPhone in 2026?',
       'tech', 0.18, 2500, 'Yes', 'No', false),
      ('Will GTA VI release before July 2026?',
       'entertainment', 0.12, 5000, 'Yes', 'No', true),
      ('Will Solana exceed $500 in 2026?',
       'crypto', 0.25, 3500, 'Above $500', 'Below $500', false),
      ('Will the Lakers win the 2026 NBA championship?',
       'sports', 0.15, 3000, 'Yes', 'No', false),
      ('Oscar Best Picture: sci-fi film wins in 2027?',
       'entertainment', 0.20, 2000, 'Yes', 'No', false),
      ('Will global temperatures set a new record in 2026?',
       'world', 0.78, 2500, 'Yes', 'No', false),
      ('Will TikTok be banned in the US in 2026?',
       'culture', 0.30, 3500, 'Yes', 'No', false)
    ) as t(question, category, yes_price, subsidy, yes_label, no_label, featured)
  loop
    if exists (
      select 1 from public.markets
       where source = 'platform'
         and question = v_seed.question
    ) then
      continue;
    end if;

    perform public._create_platform_market(
      v_admin,
      v_seed.question,
      'Official Vibebet market — play money only.',
      v_seed.subsidy,
      v_seed.yes_price,
      now() + interval '180 days',
      v_seed.category,
      v_seed.yes_label,
      v_seed.no_label,
      'platform'::public.market_source,
      v_seed.featured,
      null, null, null, null, null
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.admin_seed_official_markets() from public;
grant  execute on function public.admin_seed_official_markets() to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: upsert_polymarket_mirror
--   Admin-only. Creates or updates a mirror market from Polymarket gamma data.
-- -----------------------------------------------------------------------------
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
  v_admin      uuid := auth.uid();
  v_is_admin   boolean;
  v_market_id  uuid;
  v_cat        public.market_category;
  v_res_yes    bigint;
  v_res_no     bigint;
  v_subsidy    bigint := 5000;
  v_pool_total bigint := v_subsidy * 2;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if v_admin is null then raise exception 'unauthenticated'; end if;
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

  select id into v_market_id
    from public.markets
   where external_id = p_external_id;

  select r.reserve_yes, r.reserve_no
    into v_res_yes, v_res_no
    from public.cpmm_reserves_for_yes_price(v_pool_total, p_yes_price) r;

  if v_market_id is null then
    v_market_id := public._create_platform_market(
      v_admin,
      left(p_question, 280),
      left(coalesce(p_description, ''), 2000),
      v_subsidy,
      p_yes_price,
      p_closes_at,
      v_cat,
      coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
      coalesce(nullif(trim(p_no_label), ''), 'No'),
      'polymarket_mirror'::public.market_source,
      false,
      p_external_id,
      p_external_url,
      p_external_vol,
      p_external_vol_24h,
      p_image_url
    );
  else
    update public.markets
       set question                  = left(p_question, 280),
           description               = left(coalesce(p_description, ''), 2000),
           reserve_yes               = v_res_yes,
           reserve_no                = v_res_no,
           closes_at                 = coalesce(p_closes_at, closes_at),
           category                  = v_cat,
           outcome_yes_label         = coalesce(nullif(trim(p_yes_label), ''), outcome_yes_label),
           outcome_no_label          = coalesce(nullif(trim(p_no_label), ''), outcome_no_label),
           image_url                 = coalesce(p_image_url, image_url),
           external_url              = p_external_url,
           external_volume_usd       = p_external_vol,
           external_volume_24h_usd   = p_external_vol_24h,
           external_synced_at        = now()
     where id = v_market_id;
  end if;

  return v_market_id;
end;
$$;

revoke execute on function public.upsert_polymarket_mirror(text, text, text, numeric, timestamptz, text, text, text, text, numeric, numeric, text) from public;
grant  execute on function public.upsert_polymarket_mirror(text, text, text, numeric, timestamptz, text, text, text, text, numeric, numeric, text) to authenticated;

-- Patch create_market to tag user markets as community (existing rows stay default).
-- Re-declare only the 7-arg version from migration 6; append source = community.
create or replace function public.create_market(
  p_question         text,
  p_description      text,
  p_subsidy          bigint,
  p_closes_at        timestamptz default null,
  p_category         text        default 'other',
  p_outcome_yes_label text       default 'Yes',
  p_outcome_no_label  text       default 'No'
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
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_subsidy < 100 then raise exception 'minimum subsidy is 100 VIBE'; end if;
  if p_subsidy > 1000000 then raise exception 'maximum subsidy is 1,000,000 VIBE'; end if;
  if length(p_question) < 10 or length(p_question) > 280 then
    raise exception 'question must be 10-280 characters';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'closes_at must be in the future';
  end if;
  if p_category not in (
    'politics', 'sports', 'crypto', 'tech',
    'entertainment', 'finance', 'world', 'culture', 'other'
  ) then
    raise exception 'invalid category: %', p_category;
  end if;

  select id into v_user_wallet
    from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_user_wallet is null then raise exception 'creator wallet not found'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_user_wallet;
  if v_balance < p_subsidy then
    raise exception 'insufficient balance: have %, need %', v_balance, p_subsidy;
  end if;

  insert into public.markets (
    creator_id, question, description, subsidy,
    reserve_yes, reserve_no, closes_at,
    category, outcome_yes_label, outcome_no_label,
    source
  ) values (
    v_user_id, p_question, p_description, p_subsidy,
    p_subsidy, p_subsidy, p_closes_at,
    p_category, p_outcome_yes_label, p_outcome_no_label,
    'community'::public.market_source
  )
  returning id into v_market_id;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'market_pool:' || v_market_id::text)
  returning id into v_market_pool;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_create',
    'market_create:' || v_market_id::text,
    jsonb_build_object('market_id', v_market_id, 'subsidy', p_subsidy, 'category', p_category),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_subsidy, 'vibe'),
    (v_tx_id, v_market_pool,  p_subsidy, 'vibe');

  return v_market_id;
end;
$$;

-- Rebuild markets_view to expose source + external columns.
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
