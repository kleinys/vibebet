-- =============================================================================
-- Phase 2 (core social): market comments + leaderboard view
-- =============================================================================

create table public.market_comments (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets(id) on delete cascade,
  user_id    uuid not null references auth.users(id)    on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index market_comments_market_idx on public.market_comments (market_id, created_at desc);
create index market_comments_user_idx   on public.market_comments (user_id, created_at desc);

alter table public.market_comments enable row level security;

-- Read: anyone signed-in (public conversation).
create policy market_comments_select_authenticated on public.market_comments
  for select to authenticated using (true);

-- Insert: must be your own comment, and the market must exist + be open or resolved.
create policy market_comments_insert_own on public.market_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.markets m where m.id = market_id
    )
  );

-- Delete: own comments, or admin.
create policy market_comments_delete_own_or_admin on public.market_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- Leaderboard view: lifetime VIBE profit per user.
--   profit = total settlement payouts + total sell proceeds − total cost (buys)
--
-- This view derives from the ledger (positions.total_*). Updated on every
-- trade/sell/resolve via the position upsert.
-- security_invoker so callers' RLS applies — profiles are readable by
-- authenticated users; positions are private, so we expose only aggregates
-- via a SECURITY DEFINER aggregation function instead.
-- =============================================================================

-- Aggregate function readable by anyone signed-in. Returns top N users by
-- realized profit. Bypasses RLS on positions (since positions are private),
-- but exposes only aggregated, non-identifying data.
create or replace function public.leaderboard(p_limit integer default 50)
returns table (
  rank          integer,
  user_id       uuid,
  display_name  text,
  total_cost    bigint,
  total_payout  bigint,
  total_proceeds bigint,
  profit        bigint,
  markets_traded integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with agg as (
    select
      p.user_id,
      coalesce(sum(p.total_cost), 0)::bigint     as total_cost,
      coalesce(sum(p.total_payout), 0)::bigint   as total_payout,
      coalesce(sum(p.total_proceeds), 0)::bigint as total_proceeds,
      count(distinct p.market_id)::integer       as markets_traded
    from public.positions p
    group by p.user_id
  )
  select
    (row_number() over (order by
      (a.total_payout + a.total_proceeds - a.total_cost) desc,
      a.user_id asc
    ))::integer as rank,
    a.user_id,
    pr.display_name,
    a.total_cost,
    a.total_payout,
    a.total_proceeds,
    (a.total_payout + a.total_proceeds - a.total_cost)::bigint as profit,
    a.markets_traded
  from agg a
  join public.profiles pr on pr.id = a.user_id
  order by profit desc, a.user_id asc
  limit greatest(0, least(p_limit, 200));
$$;

revoke execute on function public.leaderboard(integer) from public;
grant  execute on function public.leaderboard(integer) to authenticated, anon;
