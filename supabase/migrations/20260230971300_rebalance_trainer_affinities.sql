-- Rebalance trainer affinities: cap trinity-style buffs, soften base archetypes and pair synergies.

create or replace function public.open_locker_crate(p_stake bigint default 250)
returns table (
  label text,
  payout bigint,
  net bigint,
  new_balance bigint,
  momentum int,
  momentum_delta int,
  super_active boolean,
  super_seconds_left int,
  payout_multiplier numeric,
  affinity_label text,
  is_jackpot boolean
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
  v_roll numeric;
  v_payout bigint;
  v_label text;
  v_ref text;
  v_skin text;
  v_animal text;
  v_arch text;
  v_pair text;
  v_mom public.locker_momentum;
  v_super boolean;
  v_mult numeric := 1.0;
  v_charge bigint;
  v_net bigint;
  v_delta int;
  v_jackpot boolean := false;
  v_chain_mult numeric := 1.0;
  v_common_threshold numeric := 0.40;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 50 or p_stake > 5000 then
    raise exception 'crate stake must be 50–5,000 VIBE';
  end if;

  v_mom := public._locker_ensure_momentum(v_user_id);
  v_skin := public._locker_equipped_skin(v_user_id);
  v_animal := public._locker_animal_for_skin(v_skin);
  v_arch := public._locker_archetype_for_skin(v_skin);
  v_pair := v_skin || '|' || v_animal;
  v_super := public._locker_super_active(v_mom.super_until);
  v_charge := p_stake;

  if v_pair = 'blood-moon|bat' then
    v_charge := greatest(50, (p_stake * 0.97)::bigint);
  end if;

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance < v_charge then
    raise exception 'insufficient VIBE: need %, have %', v_charge, v_balance;
  end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  select id into v_burn from public.accounts
  where kind = 'system_burn' and currency = 'vibe' and code = 'locker_crate_burn';
  if v_burn is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'vibe', 'locker_crate_burn')
    returning id into v_burn;
  end if;

  v_roll := random();

  if v_arch = 'steady' then
    v_common_threshold := 0.32;
  end if;

  if v_arch = 'volatile' then
    if v_roll < 0.35 then
      v_payout := (p_stake * (0.15 + random() * 0.35))::bigint;
      v_label := 'Common drop';
    elsif v_roll < 0.72 then
      v_payout := (p_stake * (0.85 + random() * 0.45))::bigint;
      v_label := 'Uncommon drop';
    elsif v_roll < 0.90 then
      v_payout := (p_stake * (1.4 + random() * 0.9))::bigint;
      v_label := 'Rare drop';
    elsif v_roll < 0.985 then
      v_payout := (p_stake * (2.5 + random() * 1.5))::bigint;
      v_label := 'Epic drop';
    else
      v_payout := (p_stake * (5 + random() * 4))::bigint;
      v_label := 'Legendary jackpot';
      v_jackpot := true;
    end if;
  else
    if v_roll < v_common_threshold then
      v_payout := (p_stake * (0.15 + random() * 0.35))::bigint;
      v_label := 'Common drop';
      if v_arch = 'steady' then
        v_payout := greatest(v_payout, (p_stake * 0.1)::bigint);
      end if;
      if v_arch = 'arcane' and random() < 0.05 then
        v_payout := (p_stake * (0.85 + random() * 0.45))::bigint;
        v_label := 'Arcane upgrade';
      end if;
    elsif v_roll < 0.75 then
      v_payout := (p_stake * (0.85 + random() * 0.45))::bigint;
      v_label := 'Uncommon drop';
    elsif v_roll < 0.93 then
      v_payout := (p_stake * (1.4 + random() * 0.9))::bigint;
      v_label := 'Rare drop';
    elsif v_roll < 0.99 then
      v_payout := (p_stake * (2.5 + random() * 1.5))::bigint;
      v_label := 'Epic drop';
      if v_payout >= p_stake * 4 then v_jackpot := true; end if;
    else
      v_payout := (p_stake * (5 + random() * 4))::bigint;
      v_label := 'Legendary jackpot';
      v_jackpot := true;
    end if;
  end if;

  v_payout := greatest(10, v_payout);

  if v_arch = 'streak' then
    v_chain_mult := 1.0 + least(v_mom.case_chain * 0.02, 0.10);
    if v_pair = 'storm-titan|bear' then
      v_chain_mult := v_chain_mult * 1.08;
    end if;
    v_payout := (v_payout * v_chain_mult)::bigint;
    v_mult := v_mult * v_chain_mult;
  end if;

  if v_pair = 'frost-walker|serpent' then
    v_payout := (v_payout * 1.05)::bigint;
    v_mult := v_mult * 1.05;
  end if;

  if v_arch = 'volatile' and v_jackpot then
    v_payout := (v_payout * 1.1)::bigint;
    v_mult := v_mult * 1.1;
  end if;

  if v_super and v_jackpot then
    v_payout := v_payout * 2;
    v_mult := v_mult * 2;
  end if;

  v_ref := 'locker_crate:' || gen_random_uuid()::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'locker_crate',
    v_ref,
    jsonb_build_object(
      'stake', p_stake,
      'charge', v_charge,
      'payout', v_payout,
      'label', v_label,
      'archetype', v_arch,
      'super', v_super,
      'multiplier', v_mult,
      'jackpot', v_jackpot
    ),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -v_charge, 'vibe'),
    (v_tx_id, v_burn, v_charge, 'vibe');

  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  v_net := v_payout - v_charge;
  v_delta := case when v_net >= 0 then 30 else -10 end;
  v_mom := public._locker_apply_momentum(v_user_id, v_delta, v_net);

  update public.locker_momentum
  set
    case_chain = case when v_net >= 0 then case_chain + 1 else 0 end,
    wheel_chain = case when v_net < 0 then 0 else wheel_chain end,
    updated_at = timezone('utc', now())
  where user_id = v_user_id
  returning * into v_mom;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;

  return query
  select
    v_label,
    v_payout,
    v_net,
    v_balance,
    v_mom.momentum,
    v_delta,
    public._locker_super_active(v_mom.super_until),
    greatest(0, extract(epoch from (v_mom.super_until - timezone('utc', now())))::int),
    round(v_mult, 2),
    initcap(v_arch),
    v_jackpot;
end;
$$;

create or replace function public.spin_locker_wheel(p_paid_stake bigint default 100)
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
  is_jackpot boolean
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
  if p_paid_stake < 50 or p_paid_stake > 2000 then
    raise exception 'paid spin stake must be 50–2,000 VIBE';
  end if;

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
      'payout', v_payout,
      'cost', v_cost,
      'free_spin', v_free,
      'archetype', v_arch,
      'super', v_super,
      'multiplier', v_mult,
      'jackpot', v_jackpot
    ),
    v_user_id
  ) returning id into v_tx_id;

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

  insert into public.locker_wheel_daily (user_id, spin_date, spins_used)
  values (v_user_id, v_today, 1)
  on conflict (user_id, spin_date)
  do update set spins_used = public.locker_wheel_daily.spins_used + 1;

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
    v_jackpot;
end;
$$;

-- Align medium-risk Plinko slot multipliers with arena board preview.
create or replace function public.play_plinko(p_stake bigint, p_risk text default 'medium')
returns table (slot_index int, multiplier numeric, payout bigint, net bigint, new_balance bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_wallet uuid; v_mint uuid; v_burn uuid; v_tx_id uuid;
  v_balance bigint; v_mult numeric; v_payout bigint; v_net bigint;
  v_slots numeric[]; v_weights numeric[]; v_total numeric := 0; v_pick numeric; v_i int; v_idx int := 1;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 5000 then raise exception 'stake must be 10–5,000 VIBE'; end if;
  if p_risk not in ('low', 'medium', 'high') then raise exception 'risk must be low, medium, or high'; end if;

  if p_risk = 'low' then
    v_weights := array[6, 8, 10, 12, 14, 18, 22, 18, 14, 12, 10, 8, 6];
    v_slots := array[3, 2, 1.5, 1.2, 1, 0.3, 0.5, 0.3, 1, 1.2, 1.5, 2, 3];
  elsif p_risk = 'high' then
    v_weights := array[3, 5, 7, 9, 12, 16, 28, 16, 12, 9, 7, 5, 3];
    v_slots := array[10, 5, 3, 2, 0.5, 0.2, 0.1, 0.2, 0.5, 2, 3, 5, 10];
  else
    v_weights := array[4, 6, 8, 10, 13, 17, 26, 17, 13, 10, 8, 6, 4];
    v_slots := array[5, 3, 2, 1, 0.5, 0.2, 0.1, 0.2, 0.5, 1, 2, 3, 5];
  end if;

  for v_i in 1..array_length(v_weights, 1) loop v_total := v_total + v_weights[v_i]; end loop;
  v_pick := random() * v_total; v_total := 0;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then v_idx := v_i; exit; end if;
  end loop;
  v_mult := v_slots[v_idx]; v_payout := floor(p_stake * v_mult)::bigint; v_net := v_payout - p_stake;

  select public._wallet_for_user(v_user_id) into v_wallet;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then raise exception 'insufficient VIBE'; end if;

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  v_burn := public._ensure_system_account('system_burn', 'vibe', 'plinko_burn');

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('plinko', 'plinko:' || gen_random_uuid()::text,
    jsonb_build_object('stake', p_stake, 'risk', p_risk, 'slot', v_idx, 'multiplier', v_mult, 'payout', v_payout),
    v_user_id) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'), (v_tx_id, v_burn, p_stake, 'vibe');
  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  return query select v_idx - 1, v_mult, v_payout, v_net, v_balance;
end;
$$;
