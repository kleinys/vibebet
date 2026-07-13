-- Phase 54: Interconnect layer — adrenaline tokens, cathedral, cross-mode hooks

-- ---------------------------------------------------------------------------
-- Consumable helpers (service + RPC grants; users consume via spin RPC)
-- ---------------------------------------------------------------------------

create or replace function public._grant_consumable(
  p_user_id uuid,
  p_slug text,
  p_qty int default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_qty < 1 then return; end if;

  insert into public.user_consumables (user_id, slug, quantity, updated_at)
  values (p_user_id, p_slug, p_qty, now())
  on conflict (user_id, slug) do update
  set quantity = public.user_consumables.quantity + excluded.quantity,
      updated_at = now();
end;
$$;

revoke all on function public._grant_consumable(uuid, text, int) from public;

create or replace function public._consume_consumable(
  p_user_id uuid,
  p_slug text,
  p_qty int default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left int;
begin
  if p_user_id is null or p_qty < 1 then return false; end if;

  update public.user_consumables
  set quantity = quantity - p_qty,
      updated_at = now()
  where user_id = p_user_id
    and slug = p_slug
    and quantity >= p_qty
  returning quantity into v_left;

  return found;
end;
$$;

revoke all on function public._consume_consumable(uuid, text, int) from public;

create or replace function public.get_my_consumables()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('slug', c.slug, 'quantity', c.quantity)
      order by c.slug
    ),
    '[]'::jsonb
  )
  from public.user_consumables c
  where c.user_id = auth.uid()
    and c.quantity > 0;
$$;

revoke all on function public.get_my_consumables() from public;
grant execute on function public.get_my_consumables() to authenticated;

-- ---------------------------------------------------------------------------
-- Duel wins → adrenaline token (cross-mode interconnect)
-- ---------------------------------------------------------------------------

create or replace function public._grant_adrenaline_on_duel_win(p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_winner_id is null then return; end if;
  perform public._grant_consumable(p_winner_id, 'adrenaline_token', 1);
end;
$$;

revoke all on function public._grant_adrenaline_on_duel_win(uuid) from public;

create or replace function public._after_duel_win_hustle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'settled'
     and new.winner_id is not null
     and (old.winner_id is distinct from new.winner_id or old.status is distinct from new.status)
  then
    perform public._tick_daily_hustle(new.winner_id, 'duel_wins', 1);
    perform public._grant_adrenaline_on_duel_win(new.winner_id);
  end if;
  return new;
end;
$$;

create or replace function public._settle_skill_duel(
  p_escrow_code   text,
  p_winner_id     uuid,
  p_creator_id    uuid,
  p_opponent_id   uuid,
  p_stake         bigint,
  p_is_friendly   boolean,
  p_game_key      text,
  p_is_draw       boolean,
  p_tx_kind       text,
  p_tx_ref        text,
  p_metadata      jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pool   bigint;
  v_payout bigint;
  v_escrow uuid;
  v_wallet uuid;
  v_mint   uuid;
  v_tx_id  uuid;
  v_loser  uuid;
begin
  if p_stake <= 0 then
    if not p_is_draw and p_winner_id is not null and not p_is_friendly then
      v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
      perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
      perform public._tick_daily_hustle(p_winner_id, 'duel_wins', 1);
      perform public._grant_adrenaline_on_duel_win(p_winner_id);
    elsif p_is_draw and not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;

  if p_is_draw then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (p_tx_kind || '_draw', p_tx_ref || ':draw', p_metadata, p_creator_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_creator_id), p_stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_opponent_id), p_stake, 'vibe');
    if not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  select public._wallet_for_user(p_winner_id) into v_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_tx_kind, p_tx_ref, p_metadata || jsonb_build_object('winner_id', p_winner_id), p_winner_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  if not p_is_friendly then
    v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
    perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
  end if;

  if p_winner_id is not null then
    perform public._tick_daily_hustle(p_winner_id, 'duel_wins', 1);
    if not p_is_friendly then
      perform public._grant_adrenaline_on_duel_win(p_winner_id);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Legacy Cathedral v1 — computed milestones (shareable via username)
-- ---------------------------------------------------------------------------

create or replace function public.get_legacy_cathedral(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_profile public.profiles%rowtype;
  v_elements jsonb := '[]'::jsonb;
  v_count int := 0;
  v_first_bet boolean := false;
  v_duel boolean := false;
  v_wheel boolean := false;
  v_hustle_claim boolean := false;
  v_pass_complete boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('visible', false);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    return jsonb_build_object('visible', false);
  end if;

  v_elements := v_elements || jsonb_build_object(
    'id', 'foundation', 'label', 'Foundation', 'done', true
  );
  v_count := v_count + 1;

  select exists (
    select 1 from public.onboarding_progress o
    where o.user_id = v_user_id and o.first_bet_at is not null
  )
  or exists (
    select 1 from public.trades t where t.user_id = v_user_id and t.cost > 0 limit 1
  )
  into v_first_bet;

  if v_first_bet then
    v_elements := v_elements || jsonb_build_object(
      'id', 'market_wing', 'label', 'Market wing', 'done', true
    );
    v_count := v_count + 1;
  end if;

  v_duel := public._user_has_finished_duel(v_user_id);
  if v_duel then
    v_elements := v_elements || jsonb_build_object(
      'id', 'duel_tower', 'label', 'Duel tower', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select exists (
    select 1 from public.user_daily_hustle_progress h
    where h.user_id = v_user_id and h.claimed_at is not null limit 1
  )
  into v_hustle_claim;

  if v_hustle_claim then
    v_elements := v_elements || jsonb_build_object(
      'id', 'hustle_hall', 'label', 'Hustle hall', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select exists (
    select 1 from public.locker_wheel_daily w
    where w.user_id = v_user_id and w.spins_used > 0
  )
  into v_wheel;

  if v_wheel then
    v_elements := v_elements || jsonb_build_object(
      'id', 'arcade_dome', 'label', 'Arcade dome', 'done', true
    );
    v_count := v_count + 1;
  end if;

  if v_profile.current_streak >= 7 then
    v_elements := v_elements || jsonb_build_object(
      'id', 'streak_beacon', 'label', 'Streak beacon', 'done', true
    );
    v_count := v_count + 1;
  end if;

  if coalesce(v_profile.hustle_tier, 1) >= 3 then
    v_elements := v_elements || jsonb_build_object(
      'id', 'trust_spire', 'label', 'Trust spire', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select (
    1
    + case when v_first_bet then 1 else 0 end
    + case when v_duel then 1 else 0 end
    + case when v_wheel then 1 else 0 end
  ) >= 4
  into v_pass_complete;

  if v_pass_complete then
    v_elements := v_elements || jsonb_build_object(
      'id', 'crown', 'label', 'Vibe Pass crown', 'done', true
    );
    v_count := v_count + 1;
  end if;

  return jsonb_build_object(
    'visible', true,
    'wings', v_count,
    'max_wings', 8,
    'percent', least(100, round(100.0 * v_count / 8.0)),
    'display_name', v_profile.display_name,
    'companion_name', v_profile.companion_name,
    'public_slug', coalesce(v_profile.username, v_user_id::text),
    'elements', v_elements
  );
end;
$$;

revoke all on function public.get_legacy_cathedral(uuid) from public;
grant execute on function public.get_legacy_cathedral(uuid) to authenticated;
grant execute on function public.get_legacy_cathedral(uuid) to anon;

-- ---------------------------------------------------------------------------
-- Adrenaline token spin — free wheel spin with luck boost (no VIBE cost)
-- ---------------------------------------------------------------------------

create or replace function public.spin_locker_wheel(
  p_paid_stake bigint default 100,
  p_use_adrenaline_token boolean default false
)
returns table (
  segment_index int,
  label text,
  payout bigint,
  cost bigint,
  net bigint,
  new_balance bigint,
  free_spin boolean,
  momentum int,
  momentum_delta int,
  super_active boolean,
  super_seconds_left int,
  payout_multiplier numeric,
  affinity_label text,
  is_jackpot boolean,
  adrenaline_spin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet uuid;
  v_mint uuid;
  v_burn uuid;
  v_tx_id uuid;
  v_balance bigint;
  v_cost bigint := 0;
  v_free boolean := false;
  v_adrenaline boolean := false;
  v_spins int := 0;
  v_today date := (timezone('utc', now()))::date;
  v_roll numeric;
  v_idx int;
  v_payout bigint;
  v_label text;
  v_ref text;
  v_skin text;
  v_animal text;
  v_pair text;
  v_arch text;
  v_mom public.locker_momentum;
  v_super boolean;
  v_mult numeric := 1.0;
  v_net bigint;
  v_delta int;
  v_jackpot boolean := false;
  v_chain_mult numeric := 1.0;
  v_floor bigint := 0;
  v_segments text[] := array[
    '25 VIBE', '100 VIBE', '50 VIBE', '500 VIBE', '10 VIBE', '250 VIBE',
    '75 VIBE', '1000 VIBE', '15 VIBE', '200 VIBE', '30 VIBE', '2500 JACKPOT'
  ];
  v_payouts bigint[] := array[25, 100, 50, 500, 10, 250, 75, 1000, 15, 200, 30, 2500];
  v_weights numeric[] := array[14, 8, 12, 7, 16, 6, 10, 6, 15, 7, 13, 3];
  v_total numeric := 0;
  v_pick numeric;
  v_i int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_mom := public._locker_ensure_momentum(v_user_id);
  v_skin := public._locker_equipped_skin(v_user_id);
  v_animal := public._locker_animal_for_skin(v_skin);
  v_pair := v_skin || '|' || v_animal;
  v_arch := public._locker_archetype_for_skin(v_skin);
  v_super := public._locker_super_active(v_mom.super_until);

  if v_arch = 'arcane' then
    v_weights := array[0, 0, 0, 4, 0, 2, 0, 6, 0, 2, 0, 27];
  end if;

  if v_pair = 'nebula-ronin|crane' then
    v_weights[4] := v_weights[4] * 1.05;
    v_weights[6] := v_weights[6] * 1.05;
    v_weights[8] := v_weights[8] * 1.05;
  end if;

  if p_use_adrenaline_token then
    if not public._consume_consumable(v_user_id, 'adrenaline_token', 1) then
      raise exception 'no adrenaline token available';
    end if;
    v_adrenaline := true;
    v_cost := 0;
    v_free := false;
    v_weights[2] := v_weights[2] * 1.25;
    v_weights[4] := v_weights[4] * 1.2;
    v_weights[6] := v_weights[6] * 1.25;
    v_weights[8] := v_weights[8] * 1.15;
    v_weights[10] := v_weights[10] * 1.2;
  else
    if p_paid_stake < 50 or p_paid_stake > 2000 then
      raise exception 'paid spin stake must be 50–2,000 VIBE';
    end if;

    select coalesce(spins_used, 0) into v_spins
    from public.locker_wheel_daily
    where user_id = v_user_id and spin_date = v_today;

    if v_spins is null then v_spins := 0; end if;

    if v_spins = 0 then
      v_free := true;
      v_cost := 0;
    else
      v_cost := p_paid_stake;
    end if;
  end if;

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance < v_cost then
    raise exception 'insufficient VIBE: need %, have %', v_cost, v_balance;
  end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint'::account_kind and currency = 'vibe'::currency and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  if v_cost > 0 then
    select id into v_burn from public.accounts
    where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = 'locker_wheel_burn';
    if v_burn is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn'::account_kind, 'vibe'::currency, 'locker_wheel_burn')
      returning id into v_burn;
    end if;
  end if;

  v_roll := random();
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
  end loop;
  v_pick := v_roll * v_total;
  v_total := 0;
  v_idx := 1;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then
      v_idx := v_i;
      exit;
    end if;
  end loop;

  v_label := v_segments[v_idx];
  v_payout := v_payouts[v_idx];
  if v_idx = 12 then v_jackpot := true; end if;
  if v_payout >= 500 then v_jackpot := true; end if;

  if v_adrenaline and v_payout < 100 then
    v_payout := v_payout + 15;
  end if;

  if v_arch = 'volatile' and v_payout >= 250 then
    v_payout := (v_payout * 1.1)::bigint;
    v_mult := v_mult * 1.1;
  end if;

  if v_arch = 'steady' and v_cost > 0 and v_payout < v_cost then
    v_floor := greatest((v_cost * 0.1)::bigint, 1);
    if v_pair = 'aurora-sage|owl' then
      v_floor := greatest(v_floor, (v_cost * 0.12)::bigint);
    end if;
    v_payout := greatest(v_payout, v_floor);
  end if;

  if v_arch = 'streak' then
    v_chain_mult := 1.0 + least(v_mom.wheel_chain * 0.02, 0.10);
    if v_pair = 'storm-titan|bear' then
      v_chain_mult := v_chain_mult * 1.08;
    end if;
    v_payout := (v_payout * v_chain_mult)::bigint;
    v_mult := v_mult * v_chain_mult;
  end if;

  if v_super and v_jackpot then
    v_payout := v_payout * 2;
    v_mult := v_mult * 2;
  end if;

  v_ref := 'locker_wheel:' || gen_random_uuid()::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'locker_wheel',
    v_ref,
    jsonb_build_object(
      'segment', v_idx,
      'label', v_label,
      'cost', v_cost,
      'free_spin', v_free,
      'adrenaline_spin', v_adrenaline,
      'skin', v_skin,
      'animal', v_animal,
      'archetype', v_arch
    ),
    v_user_id
  )
  returning id into v_tx_id;

  if v_cost > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, -v_cost, 'vibe'),
      (v_tx_id, v_burn, v_cost, 'vibe');
  end if;

  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  v_net := v_payout - v_cost;
  v_delta := case when v_net >= 0 then 20 else -10 end;
  v_mom := public._locker_apply_momentum(v_user_id, v_delta, v_net);

  update public.locker_momentum
  set
    wheel_chain = case when v_net >= 0 then wheel_chain + 1 else 0 end,
    case_chain = case when v_net < 0 then 0 else case_chain end,
    updated_at = timezone('utc', now())
  where user_id = v_user_id
  returning * into v_mom;

  insert into public.locker_wheel_daily (user_id, spin_date, spins_used)
  values (v_user_id, v_today, 1)
  on conflict (user_id, spin_date)
  do update set spins_used = public.locker_wheel_daily.spins_used + 1;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;

  return query
  select
    v_idx - 1,
    v_label,
    v_payout,
    v_cost,
    v_net,
    v_balance,
    v_free,
    v_mom.momentum,
    v_delta,
    public._locker_super_active(v_mom.super_until),
    greatest(0, extract(epoch from (v_mom.super_until - timezone('utc', now())))::int),
    round(v_mult, 2),
    initcap(v_arch),
    v_jackpot,
    v_adrenaline;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values
  ('interconnect_layer_enabled', true, 'Phase 2 interconnect — adrenaline tokens, cathedral, unified nav, watch embed')
on conflict (key) do update
  set description = excluded.description;
