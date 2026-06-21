-- =============================================================================
-- Phase 2.5: Polymarket-style discovery
-- =============================================================================
-- - Categories (Politics, Sports, Crypto, Tech, Entertainment, Finance, Other)
-- - Custom YES/NO labels per market (e.g. "Up"/"Down", "Trump"/"Harris")
-- - Featured flag for editorial curation
-- - Optional image URL per market
-- - 24h volume + 24h price change derived from `trades` (no separate snapshot
--   table needed; trades store post-trade reserves, so historical price is
--   reconstructable in O(log n) per market).
-- =============================================================================

alter table public.markets
  add column category           text not null default 'other'
    check (category in (
      'politics', 'sports', 'crypto', 'tech',
      'entertainment', 'finance', 'world', 'culture', 'other'
    )),
  add column image_url          text,
  add column is_featured        boolean not null default false,
  add column outcome_yes_label  text not null default 'Yes'
    check (length(outcome_yes_label) between 1 and 32),
  add column outcome_no_label   text not null default 'No'
    check (length(outcome_no_label) between 1 and 32);

create index markets_category_status_idx
  on public.markets (category, status, created_at desc);

create index markets_featured_idx
  on public.markets (is_featured, status)
  where is_featured = true;

-- -----------------------------------------------------------------------------
-- Replace markets_view with one that includes 24h stats.
-- We DROP and CREATE rather than CREATE OR REPLACE because the underlying
-- `m.*` expansion now includes new columns and CREATE OR REPLACE wouldn't
-- accept a column-list change.
-- -----------------------------------------------------------------------------
drop view public.markets_view;

create view public.markets_view
with (security_invoker = true) as
select
  m.*,
  (m.reserve_no::numeric / nullif(m.reserve_yes + m.reserve_no, 0))::numeric
    as yes_price,
  -- Price 24h ago: derived from the most recent trade BEFORE 24h ago.
  -- If no such trade, the market opened ≤ 24h ago and price was 0.5 at start
  -- (we always seed reserves equally at creation).
  coalesce((
    select (t.reserve_no_after::numeric
            / nullif(t.reserve_yes_after + t.reserve_no_after, 0))::numeric
    from public.trades t
    where t.market_id = m.id
      and t.created_at < (now() - interval '24 hours')
    order by t.created_at desc
    limit 1
  ), 0.5::numeric) as yes_price_24h_ago,
  -- Volume uses |cost| so sells (negative cost) count as activity.
  coalesce((
    select sum(abs(t.cost))::bigint
    from public.trades t
    where t.market_id = m.id
  ), 0)::bigint as volume,
  coalesce((
    select count(*)::int
    from public.trades t
    where t.market_id = m.id
  ), 0)::int as trade_count,
  coalesce((
    select sum(abs(t.cost))::bigint
    from public.trades t
    where t.market_id = m.id
      and t.created_at >= (now() - interval '24 hours')
  ), 0)::bigint as volume_24h
from public.markets m;

-- -----------------------------------------------------------------------------
-- Update create_market to accept category + custom labels.
-- The old signature still works (defaults applied) but we add a new overload
-- with all parameters. PostgREST exposes both.
-- -----------------------------------------------------------------------------
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
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_subsidy < 100 then
    raise exception 'minimum subsidy is 100 VIBE';
  end if;
  if p_subsidy > 1000000 then
    raise exception 'maximum subsidy is 1,000,000 VIBE';
  end if;
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
  where owner_user_id = v_user_id
    and kind = 'user_wallet'
    and currency = 'vibe';

  if v_user_wallet is null then
    raise exception 'creator wallet not found';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries
  where account_id = v_user_wallet;

  if v_balance < p_subsidy then
    raise exception 'insufficient balance: have %, need %', v_balance, p_subsidy;
  end if;

  insert into public.markets (
    creator_id, question, description, subsidy,
    reserve_yes, reserve_no, closes_at,
    category, outcome_yes_label, outcome_no_label
  ) values (
    v_user_id, p_question, p_description, p_subsidy,
    p_subsidy, p_subsidy, p_closes_at,
    p_category, p_outcome_yes_label, p_outcome_no_label
  )
  returning id into v_market_id;

  insert into public.accounts (kind, currency, code)
  values ('system_burn', 'vibe', 'market_pool:' || v_market_id::text)
  returning id into v_market_pool;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_create',
    'market_create:' || v_market_id::text,
    jsonb_build_object(
      'market_id', v_market_id,
      'subsidy', p_subsidy,
      'category', p_category
    ),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -p_subsidy, 'vibe'),
    (v_tx_id, v_market_pool, p_subsidy, 'vibe');

  return v_market_id;
end;
$$;

-- Drop the old 4-arg signature so PostgREST exposes only the new one. This is
-- safe since no production code depends on the old signature yet.
drop function if exists public.create_market(text, text, bigint, timestamptz);

revoke execute on function public.create_market(text, text, bigint, timestamptz, text, text, text) from public;
grant  execute on function public.create_market(text, text, bigint, timestamptz, text, text, text) to authenticated;
