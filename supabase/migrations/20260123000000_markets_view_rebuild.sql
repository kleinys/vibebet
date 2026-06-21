-- =============================================================================
-- Hotfix: rebuild markets_view after fast / recurring columns on markets
-- =============================================================================
-- PostgreSQL views snapshot column lists at CREATE time. Adding fast_asset,
-- window_end, recurring_series_id, etc. to public.markets does NOT update
-- markets_view until it is recreated — queries then fail with SQLSTATE 42703.
-- Safe to re-run.
-- =============================================================================

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
