-- =============================================================================
-- Phase 49: HustleOS Phase E — Hustle Shares (Postgres equity, no fiat yet)
-- =============================================================================
-- Convert Hustle Cash → Shares. Redeem shares back to Hustle Cash at floor rate.
-- Real USD withdrawals deferred until KYC/legal (separate flag, stays OFF).

alter table public.profiles
  add column if not exists hustle_shares numeric(12, 4) not null default 0
    check (hustle_shares >= 0 and hustle_shares <= 100);

create table if not exists public.hustle_share_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  delta_shares        numeric(12, 4) not null,
  hustle_cash_delta   bigint not null default 0,
  kind                text not null
    check (kind in ('cash_to_shares', 'shares_to_cash', 'gig_bonus', 'tier_bonus')),
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists hustle_share_ledger_user_idx
  on public.hustle_share_ledger (user_id, created_at desc);

alter table public.hustle_share_ledger enable row level security;

drop policy if exists hustle_share_ledger_select_own on public.hustle_share_ledger;
create policy hustle_share_ledger_select_own on public.hustle_share_ledger
  for select to authenticated using (user_id = auth.uid());

-- Rates (VIBE units): 100 Hustle Cash = 1 Share; floor redeem 90 Cash per Share
create or replace function public._hustle_shares_day_converted(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(abs(hustle_cash_delta)), 0)::bigint
  from public.hustle_share_ledger
  where user_id = p_user_id
    and kind = 'cash_to_shares'
    and created_at >= (now() at time zone 'utc')::date;
$$;

create or replace function public.get_hustle_equity()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_history jsonb;
  v_floor bigint;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;

  v_floor := floor(coalesce(v_profile.hustle_shares, 0) * 90)::bigint;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
  into v_history
  from (
    select
      l.id,
      l.delta_shares,
      l.hustle_cash_delta,
      l.kind,
      l.created_at
    from public.hustle_share_ledger l
    where l.user_id = v_user_id
    order by l.created_at desc
    limit 15
  ) h;

  return jsonb_build_object(
    'authenticated', true,
    'hustle_shares', coalesce(v_profile.hustle_shares, 0),
    'hustle_cash', coalesce(v_profile.hustle_cash_vibe, 0),
    'hustle_tier', coalesce(v_profile.hustle_tier, 1),
    'floor_cash_value', v_floor,
    'convert_rate', 100,
    'floor_redeem_rate', 90,
    'max_shares', 100,
    'min_convert_tier', 3,
    'min_redeem_tier', 4,
    'daily_convert_limit', 5000,
    'daily_converted_today', public._hustle_shares_day_converted(v_user_id),
    'can_convert', coalesce(v_profile.hustle_tier, 1) >= 3,
    'can_redeem', coalesce(v_profile.hustle_tier, 1) >= 4,
    'history', v_history
  );
end;
$$;

revoke execute on function public.get_hustle_equity() from public;
grant execute on function public.get_hustle_equity() to authenticated;

create or replace function public.convert_hustle_cash_to_shares(p_hustle_cash bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_shares numeric(12, 4);
  v_daily bigint;
  v_new_shares numeric(12, 4);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_hustle_cash is null or p_hustle_cash < 100 then
    raise exception 'minimum conversion is 100 Hustle Cash';
  end if;
  if p_hustle_cash > 5000 then
    raise exception 'maximum single conversion is 5000 Hustle Cash';
  end if;
  if mod(p_hustle_cash, 100) <> 0 then
    raise exception 'amount must be in multiples of 100 Hustle Cash';
  end if;

  select * into v_profile from public.profiles where id = v_user_id for update;

  if coalesce(v_profile.hustle_tier, 1) < 3 then
    raise exception 'Gig tier (3) required to buy shares';
  end if;

  v_daily := public._hustle_shares_day_converted(v_user_id);
  if v_daily + p_hustle_cash > 5000 then
    raise exception 'daily conversion limit is 5000 Hustle Cash';
  end if;

  if coalesce(v_profile.hustle_cash_vibe, 0) < p_hustle_cash then
    raise exception 'insufficient hustle cash';
  end if;

  v_shares := (p_hustle_cash / 100.0)::numeric(12, 4);
  v_new_shares := coalesce(v_profile.hustle_shares, 0) + v_shares;

  if v_new_shares > 100 then
    raise exception 'share cap is 100 — would exceed limit';
  end if;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe - p_hustle_cash,
      hustle_shares = v_new_shares
  where id = v_user_id;

  insert into public.hustle_share_ledger (user_id, delta_shares, hustle_cash_delta, kind, metadata)
  values (
    v_user_id,
    v_shares,
    -p_hustle_cash,
    'cash_to_shares',
    jsonb_build_object('rate', 100)
  );

  perform public.track_event('hustle_shares_minted', jsonb_build_object(
    'shares', v_shares,
    'hustle_cash', p_hustle_cash
  ));

  return jsonb_build_object('ok', true, 'shares_minted', v_shares, 'total_shares', v_new_shares);
end;
$$;

revoke execute on function public.convert_hustle_cash_to_shares(bigint) from public;
grant execute on function public.convert_hustle_cash_to_shares(bigint) to authenticated;

create or replace function public.redeem_hustle_shares_to_cash(p_shares numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_cash bigint;
  v_new_shares numeric(12, 4);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_shares is null or p_shares < 1 then
    raise exception 'minimum redemption is 1 share';
  end if;
  if p_shares <> trunc(p_shares) then
    raise exception 'redeem whole shares only';
  end if;

  select * into v_profile from public.profiles where id = v_user_id for update;

  if coalesce(v_profile.hustle_tier, 1) < 4 then
    raise exception 'Pro tier (4) required to redeem shares';
  end if;

  if coalesce(v_profile.hustle_shares, 0) < p_shares then
    raise exception 'insufficient shares';
  end if;

  v_cash := (trunc(p_shares) * 90)::bigint;
  v_new_shares := coalesce(v_profile.hustle_shares, 0) - p_shares;

  update public.profiles
  set hustle_shares = v_new_shares,
      hustle_cash_vibe = hustle_cash_vibe + v_cash
  where id = v_user_id;

  insert into public.hustle_share_ledger (user_id, delta_shares, hustle_cash_delta, kind, metadata)
  values (
    v_user_id,
    -p_shares,
    v_cash,
    'shares_to_cash',
    jsonb_build_object('floor_rate', 90)
  );

  perform public.track_event('hustle_shares_redeemed', jsonb_build_object(
    'shares', p_shares,
    'hustle_cash', v_cash
  ));

  return jsonb_build_object('ok', true, 'hustle_cash_received', v_cash, 'shares_remaining', v_new_shares);
end;
$$;

revoke execute on function public.redeem_hustle_shares_to_cash(numeric) from public;
grant execute on function public.redeem_hustle_shares_to_cash(numeric) to authenticated;

-- Small tier bonus on first Pro unlock (one-time)
create or replace function public._maybe_grant_pro_share_bonus(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_bonus numeric(12, 4) := 0.5;
begin
  if p_user_id is null then return; end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if coalesce(v_profile.hustle_tier, 1) < 4 then return; end if;

  if exists (
    select 1 from public.hustle_share_ledger
    where user_id = p_user_id and kind = 'tier_bonus'
  ) then
    return;
  end if;

  if coalesce(v_profile.hustle_shares, 0) + v_bonus > 100 then
    v_bonus := greatest(0, 100 - coalesce(v_profile.hustle_shares, 0));
  end if;

  if v_bonus <= 0 then return; end if;

  update public.profiles
  set hustle_shares = hustle_shares + v_bonus
  where id = p_user_id;

  insert into public.hustle_share_ledger (user_id, delta_shares, hustle_cash_delta, kind, metadata)
  values (p_user_id, v_bonus, 0, 'tier_bonus', jsonb_build_object('tier', 4));
end;
$$;

-- Hook tier refresh (wrap existing if present)
create or replace function public._refresh_hustle_trust(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_achievements int := 0;
  v_duel_wins int := 0;
  v_hustle_claims int := 0;
  v_score int;
  v_tier int;
  v_old_tier int;
begin
  if p_user_id is null then return; end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return; end if;

  v_old_tier := coalesce(v_profile.hustle_tier, 1);

  select count(*)::int into v_achievements
  from public.user_achievements where user_id = p_user_id;

  select count(*)::int into v_duel_wins
  from public.duels where winner_id = p_user_id and status = 'settled';

  select count(*)::int into v_hustle_claims
  from public.user_daily_hustle_progress
  where user_id = p_user_id and claimed_at is not null;

  v_score := 500
    + (v_profile.spark_claims_lifetime * 5)
    + (v_hustle_claims * 3)
    + (v_profile.current_streak * 2)
    + public._hustle_streak_bonus(v_profile.current_streak)
    + (v_achievements * 10)
    + (v_duel_wins * 15);

  v_score := greatest(0, least(1000, v_score));
  v_tier := public._resolve_hustle_tier(p_user_id, v_score, v_profile.spark_claims_lifetime);

  update public.profiles
  set trust_score = v_score,
      hustle_tier = v_tier,
      updated_at = now()
  where id = p_user_id;

  if v_tier >= 4 and v_old_tier < 4 then
    perform public._maybe_grant_pro_share_bonus(p_user_id);
  end if;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values ('hustle_shares_enabled', false, 'Hustle Shares — convert Hustle Cash to equity (no fiat yet)')
on conflict (key) do update set description = excluded.description;

insert into public.feature_flags (key, enabled, description)
values ('hustle_fiat_withdrawals_enabled', false, 'USD withdrawals — legal/KYC required, keep OFF')
on conflict (key) do update set description = excluded.description;
