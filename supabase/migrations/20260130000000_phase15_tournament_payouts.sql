-- =============================================================================
-- Phase 15: Sponsored tournament prizes + automatic payout to top 3
-- =============================================================================

alter table public.tournaments
  add column if not exists prizes_distributed boolean not null default false,
  add column if not exists sponsor_name     text,
  add column if not exists prize_splits     jsonb not null default '[50, 30, 20]'::jsonb;

create table if not exists public.tournament_payouts (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  rank           int not null check (rank >= 1),
  amount         bigint not null check (amount > 0),
  paid_at        timestamptz not null default now(),
  unique (tournament_id, rank)
);

create index if not exists tournament_payouts_tournament_idx
  on public.tournament_payouts (tournament_id, rank);

alter table public.tournament_payouts enable row level security;

drop policy if exists tournament_payouts_select on public.tournament_payouts;
create policy tournament_payouts_select on public.tournament_payouts
  for select to authenticated, anon using (true);

-- Ensure the current weekly tournament row exists
create or replace function public._ensure_current_tournament()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text := 'weekly_volume_' || to_char(date_trunc('week', now())::date, 'IYYY_IW');
begin
  insert into public.tournaments (slug, title, description, starts_at, ends_at, prize_pool, status)
  values (
    v_slug,
    'Weekly Volume Classic',
    'Most VIBE wagered this week wins sponsored play-money prizes.',
    date_trunc('week', now()),
    date_trunc('week', now()) + interval '7 days',
    2000,
    'active'
  )
  on conflict (slug) do update set
    ends_at = excluded.ends_at,
    status = case when excluded.ends_at > now() then 'active' else public.tournaments.status end
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.tournaments where slug = v_slug;
  end if;

  return v_id;
end;
$$;

revoke execute on function public._ensure_current_tournament() from public;

create or replace function public._settle_tournament(p_tournament_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_row        record;
  v_splits     numeric[];
  v_total_pct  numeric := 0;
  v_paid       int := 0;
  v_rank       int := 0;
  v_amount     bigint;
  v_remainder  bigint;
  v_wallet     uuid;
  v_mint       uuid;
  v_tx_id      uuid;
  v_split_sum  bigint := 0;
begin
  select * into v_tournament from public.tournaments
   where id = p_tournament_id for update;

  if not found then return 0; end if;
  if v_tournament.prizes_distributed then return 0; end if;
  if v_tournament.ends_at > now() then return 0; end if;
  if v_tournament.prize_pool <= 0 then
    update public.tournaments
       set status = 'closed', prizes_distributed = true
     where id = p_tournament_id;
    return 0;
  end if;

  select array_agg((value::text)::numeric order by ordinality)
    into v_splits
    from jsonb_array_elements(v_tournament.prize_splits) with ordinality;

  if v_splits is null or array_length(v_splits, 1) < 1 then
    v_splits := array[50::numeric, 30::numeric, 20::numeric];
  end if;

  select coalesce(sum(x), 0) into v_total_pct from unnest(v_splits) x;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'platform_mint';
  if v_mint is null then
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  end if;
  if v_mint is null then raise exception 'mint account missing'; end if;

  v_remainder := v_tournament.prize_pool;

  for v_row in
    select
      row_number() over (order by s.volume desc)::int as rk,
      s.user_id,
      s.volume
    from public.tournament_scores s
    where s.tournament_id = p_tournament_id
      and s.volume > 0
    order by s.volume desc
    limit coalesce(array_length(v_splits, 1), 3)
  loop
    v_rank := v_row.rk;
    exit when v_rank > coalesce(array_length(v_splits, 1), 3);

    if v_rank = coalesce(array_length(v_splits, 1), 3) then
      v_amount := v_remainder;
    else
      v_amount := floor(v_tournament.prize_pool * v_splits[v_rank] / v_total_pct)::bigint;
      v_remainder := v_remainder - v_amount;
    end if;

    if v_amount <= 0 then continue; end if;

    select id into v_wallet from public.accounts
     where owner_user_id = v_row.user_id
       and kind = 'user_wallet' and currency = 'vibe';
    if v_wallet is null then continue; end if;

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'tournament_prize',
      'tournament_prize:' || p_tournament_id::text || ':' || v_rank::text,
      jsonb_build_object(
        'tournament_id', p_tournament_id,
        'rank', v_rank,
        'user_id', v_row.user_id,
        'volume', v_row.volume
      ),
      null
    ) returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_amount, 'vibe'),
      (v_tx_id, v_mint, -v_amount, 'vibe');

    insert into public.tournament_payouts (tournament_id, user_id, rank, amount)
    values (p_tournament_id, v_row.user_id, v_rank, v_amount);

    perform public.check_achievements(v_row.user_id);

    v_paid := v_paid + 1;
    v_split_sum := v_split_sum + v_amount;
  end loop;

  update public.tournaments
     set status = 'closed',
         prizes_distributed = true,
         prize_pool = v_split_sum
   where id = p_tournament_id;

  return v_paid;
end;
$$;

revoke execute on function public._settle_tournament(uuid) from public;

create or replace function public.settle_expired_tournaments(p_limit int default 5)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament record;
  v_count int := 0;
begin
  for v_tournament in
    select id from public.tournaments
     where prizes_distributed = false
       and ends_at <= now()
     order by ends_at
     limit greatest(1, least(p_limit, 20))
  loop
    v_count := v_count + public._settle_tournament(v_tournament.id);
  end loop;

  perform public._ensure_current_tournament();

  return v_count;
end;
$$;

revoke execute on function public.settle_expired_tournaments(int) from public;
grant  execute on function public.settle_expired_tournaments(int) to authenticated, anon;

create or replace function public.admin_sponsor_tournament(
  p_tournament_id uuid,
  p_amount        bigint,
  p_sponsor_name  text default 'Vibebet'
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_amount <= 0 or p_amount > 1000000 then
    raise exception 'amount must be 1–1,000,000 VIBE';
  end if;

  select * into v_tournament from public.tournaments
   where id = p_tournament_id for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_tournament.prizes_distributed then raise exception 'tournament already settled'; end if;

  update public.tournaments
     set prize_pool = prize_pool + p_amount,
         sponsor_name = coalesce(nullif(trim(p_sponsor_name), ''), sponsor_name, 'Vibebet')
   where id = p_tournament_id
  returning prize_pool into v_tournament.prize_pool;

  return v_tournament.prize_pool;
end;
$$;

revoke execute on function public.admin_sponsor_tournament(uuid, bigint, text) from public;
grant  execute on function public.admin_sponsor_tournament(uuid, bigint, text) to authenticated;

create or replace function public.get_active_tournament()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_t public.tournaments%rowtype;
begin
  perform public.settle_expired_tournaments(3);

  select * into v_t from public.tournaments
   where status = 'active' and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1;

  if not found then
    perform public._ensure_current_tournament();
    select * into v_t from public.tournaments
     where status = 'active' and starts_at <= now() and ends_at > now()
     order by starts_at desc
     limit 1;
  end if;

  if not found then return '{}'::jsonb; end if;

  return jsonb_build_object(
    'id', v_t.id,
    'slug', v_t.slug,
    'title', v_t.title,
    'description', v_t.description,
    'starts_at', v_t.starts_at,
    'ends_at', v_t.ends_at,
    'prize_pool', v_t.prize_pool,
    'sponsor_name', v_t.sponsor_name,
    'prize_splits', v_t.prize_splits,
    'prizes_distributed', v_t.prizes_distributed
  );
end;
$$;

create or replace function public.get_tournament_payouts(p_tournament_id uuid)
returns table (
  rank         int,
  user_id      uuid,
  display_name text,
  amount       bigint,
  paid_at      timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.rank,
    p.user_id,
    coalesce(pr.display_name, 'Anonymous'),
    p.amount,
    p.paid_at
  from public.tournament_payouts p
  left join public.profiles pr on pr.id = p.user_id
  where p.tournament_id = p_tournament_id
  order by p.rank;
$$;

revoke execute on function public.get_tournament_payouts(uuid) from public;
grant  execute on function public.get_tournament_payouts(uuid) to authenticated, anon;

create or replace function public.get_last_tournament_results()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_t public.tournaments%rowtype;
  v_payouts jsonb;
begin
  select * into v_t from public.tournaments
   where prizes_distributed = true
   order by ends_at desc
   limit 1;

  if not found then return '{}'::jsonb; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', p.rank,
      'display_name', coalesce(pr.display_name, 'Anonymous'),
      'amount', p.amount
    ) order by p.rank
  ), '[]'::jsonb)
  into v_payouts
  from public.tournament_payouts p
  left join public.profiles pr on pr.id = p.user_id
  where p.tournament_id = v_t.id;

  return jsonb_build_object(
    'title', v_t.title,
    'ends_at', v_t.ends_at,
    'sponsor_name', v_t.sponsor_name,
    'total_paid', v_t.prize_pool,
    'payouts', v_payouts
  );
end;
$$;

revoke execute on function public.get_last_tournament_results() from public;
grant  execute on function public.get_last_tournament_results() to authenticated, anon;

insert into public.feature_flags (key, enabled, description)
values ('tournament_payouts_enabled', false, 'Auto-pay top 3 when weekly tournament ends + admin sponsor')
on conflict (key) do update set description = excluded.description;

-- Tournament winner achievements
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
  v_in_guild   boolean;
  v_copies     int;
  v_limit_fill int;
  v_tournament_wins int;
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
  select exists(select 1 from public.guild_members where user_id = p_user_id)
    into v_in_guild;
  select count(*)::int into v_copies from public.copy_trades
   where follower_id = p_user_id;
  select count(*)::int into v_limit_fill from public.limit_orders
   where user_id = p_user_id and status = 'filled';
  select count(*)::int into v_tournament_wins from public.tournament_payouts
   where user_id = p_user_id and rank = 1;

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

  if v_in_guild then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'guild_member') on conflict do nothing;
  end if;

  if v_copies >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_copy') on conflict do nothing;
  end if;

  if v_limit_fill >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_limit_fill') on conflict do nothing;
  end if;

  if v_tournament_wins >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'tournament_champion') on conflict do nothing;
  end if;

  return v_count;
end;
$$;
