-- =============================================================================
-- Phase 6 + 6.5: Pro subscription + Battle Pass Season 1
-- =============================================================================

alter table public.profiles
  add column if not exists is_pro          boolean not null default false,
  add column if not exists pro_expires_at  timestamptz,
  add column if not exists stripe_customer_id text;

insert into public.feature_flags (key, enabled, description)
values
  ('pro_subscription_enabled', false, 'Stripe Pro subscription checkout'),
  ('battle_pass_enabled',      false, 'Seasonal battle pass progression')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Battle Pass
-- ---------------------------------------------------------------------------
create table if not exists public.battle_pass_seasons (
  id           text primary key,
  name         text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  max_tier     int  not null default 30 check (max_tier > 0),
  xp_per_tier  int  not null default 100 check (xp_per_tier > 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.user_battle_pass (
  user_id           uuid not null references auth.users(id) on delete cascade,
  season_id         text not null references public.battle_pass_seasons(id) on delete cascade,
  xp                int  not null default 0 check (xp >= 0),
  premium_unlocked  boolean not null default false,
  claimed_free      int[] not null default '{}',
  claimed_premium   int[] not null default '{}',
  updated_at        timestamptz not null default now(),
  primary key (user_id, season_id)
);

alter table public.battle_pass_seasons enable row level security;
alter table public.user_battle_pass enable row level security;

create policy battle_pass_seasons_select on public.battle_pass_seasons
  for select to authenticated, anon using (true);

create policy user_battle_pass_select_own on public.user_battle_pass
  for select to authenticated using (auth.uid() = user_id);

insert into public.battle_pass_seasons (id, name, starts_at, ends_at, max_tier, xp_per_tier)
values (
  's1',
  'Season 1: Launch',
  now(),
  now() + interval '90 days',
  30,
  100
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RPC: grant_battle_pass_xp
-- ---------------------------------------------------------------------------
create or replace function public.grant_battle_pass_xp(p_amount int default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_season  public.battle_pass_seasons%rowtype;
  v_xp      int;
  v_tier    int;
begin
  if v_user_id is null or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_season from public.battle_pass_seasons
   where starts_at <= now() and ends_at > now()
   order by starts_at desc limit 1;
  if not found then return jsonb_build_object('skipped', true); end if;

  insert into public.user_battle_pass (user_id, season_id, xp)
  values (v_user_id, v_season.id, p_amount)
  on conflict (user_id, season_id) do update
    set xp = public.user_battle_pass.xp + excluded.xp,
        updated_at = now()
  returning xp into v_xp;

  v_tier := least(v_season.max_tier, v_xp / v_season.xp_per_tier);

  return jsonb_build_object(
    'season_id', v_season.id,
    'xp', v_xp,
    'tier', v_tier,
    'max_tier', v_season.max_tier
  );
end;
$$;

revoke execute on function public.grant_battle_pass_xp(int) from public;
grant  execute on function public.grant_battle_pass_xp(int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: claim_battle_pass_tier
-- ---------------------------------------------------------------------------
create or replace function public.claim_battle_pass_tier(
  p_tier    int,
  p_premium boolean default false
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_season    public.battle_pass_seasons%rowtype;
  v_row       public.user_battle_pass%rowtype;
  v_reward    bigint;
  v_wallet    uuid;
  v_mint      uuid;
  v_tx_id     uuid;
  v_current   int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_tier < 1 then raise exception 'invalid tier'; end if;

  select * into v_season from public.battle_pass_seasons
   where starts_at <= now() and ends_at > now()
   order by starts_at desc limit 1;
  if not found then raise exception 'no active season'; end if;

  select * into v_row from public.user_battle_pass
   where user_id = v_user_id and season_id = v_season.id for update;
  if not found then raise exception 'no progress yet — earn XP first'; end if;

  v_current := v_row.xp / v_season.xp_per_tier;
  if p_tier > v_current then
    raise exception 'tier not unlocked yet';
  end if;
  if p_premium and not v_row.premium_unlocked then
    raise exception 'premium track not unlocked';
  end if;

  if p_premium then
    if p_tier = any(v_row.claimed_premium) then
      raise exception 'already claimed';
    end if;
    v_reward := 25 + p_tier * 5;
    update public.user_battle_pass
       set claimed_premium = array_append(claimed_premium, p_tier)
     where user_id = v_user_id and season_id = v_season.id;
  else
    if p_tier = any(v_row.claimed_free) then
      raise exception 'already claimed';
    end if;
    v_reward := 10 + p_tier * 3;
    update public.user_battle_pass
       set claimed_free = array_append(claimed_free, p_tier)
     where user_id = v_user_id and season_id = v_season.id;
  end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'battle_pass_rewards';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'battle_pass_reward',
    'bp:' || v_season.id || ':' || v_user_id::text || ':' || p_tier::text || ':' || p_premium::text,
    jsonb_build_object('tier', p_tier, 'premium', p_premium, 'reward', v_reward),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_mint,   -v_reward, 'vibe'),
    (v_tx_id, v_wallet,  v_reward, 'vibe');

  return v_reward;
end;
$$;

revoke execute on function public.claim_battle_pass_tier(int, boolean) from public;
grant  execute on function public.claim_battle_pass_tier(int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: unlock_battle_pass_premium (500 Gems)
-- ---------------------------------------------------------------------------
create or replace function public.unlock_battle_pass_premium()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_season  public.battle_pass_seasons%rowtype;
  v_gem_bal bigint;
  v_wallet  uuid;
  v_burn    uuid;
  v_tx_id   uuid;
  v_cost    bigint := 500;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_season from public.battle_pass_seasons
   where starts_at <= now() and ends_at > now()
   order by starts_at desc limit 1;
  if not found then raise exception 'no active season'; end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'gem';
  select coalesce(sum(amount), 0) into v_gem_bal
    from public.ledger_entries where account_id = v_wallet;
  if v_gem_bal < v_cost then
    raise exception 'need % Gems to unlock premium track', v_cost;
  end if;

  select id into v_burn from public.accounts
   where kind = 'system_burn' and currency = 'gem' and code = 'battle_pass_premium';
  if v_burn is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'gem', 'battle_pass_premium')
    returning id into v_burn;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'battle_pass_premium',
    'bp_premium:' || v_season.id || ':' || v_user_id::text,
    jsonb_build_object('season_id', v_season.id, 'cost_gems', v_cost),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -v_cost, 'gem'),
    (v_tx_id, v_burn,     v_cost, 'gem');

  insert into public.user_battle_pass (user_id, season_id, premium_unlocked)
  values (v_user_id, v_season.id, true)
  on conflict (user_id, season_id) do update
    set premium_unlocked = true, updated_at = now();
end;
$$;

revoke execute on function public.unlock_battle_pass_premium() from public;
grant  execute on function public.unlock_battle_pass_premium() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: activate_pro_subscription (called from Stripe webhook)
-- ---------------------------------------------------------------------------
create or replace function public.activate_pro_subscription(
  p_user_id   uuid,
  p_expires   timestamptz,
  p_stripe_customer_id text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  update public.profiles
     set is_pro = true,
         pro_expires_at = p_expires,
         stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
         updated_at = now()
   where id = p_user_id;
end;
$$;

revoke execute on function public.activate_pro_subscription(uuid, timestamptz, text) from public;

-- Hook battle pass XP into daily activity
create or replace function public.record_daily_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date := (now() at time zone 'utc')::date;
  v_profile   public.profiles%rowtype;
  v_streak    int;
begin
  if v_user_id is null then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then return jsonb_build_object('skipped', true); end if;

  if v_profile.last_active_date = v_today then
    return jsonb_build_object(
      'current_streak', v_profile.current_streak,
      'already_recorded', true
    );
  end if;

  if v_profile.last_active_date = v_today - 1 then
    v_streak := v_profile.current_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
     set current_streak   = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_active_date = v_today,
         updated_at       = now()
   where id = v_user_id;

  perform public.check_achievements(v_user_id);
  perform public.grant_battle_pass_xp(15);

  return jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', greatest(v_profile.longest_streak, v_streak),
    'already_recorded', false
  );
end;
$$;
