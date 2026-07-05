-- Server-authoritative hypnotic momentum, SUPER mode (2× jackpot), and orbit affinity math.

-- ── Per-user momentum / chain state ───────────────────────────────────────────
create table if not exists public.locker_momentum (
  user_id uuid primary key references auth.users(id) on delete cascade,
  momentum int not null default 0 check (momentum >= 0 and momentum <= 100),
  super_until timestamptz,
  case_chain int not null default 0 check (case_chain >= 0),
  wheel_chain int not null default 0 check (wheel_chain >= 0),
  updated_at timestamptz not null default now()
);

alter table public.locker_momentum enable row level security;

drop policy if exists locker_momentum_select on public.locker_momentum;
create policy locker_momentum_select on public.locker_momentum
  for select to authenticated using (user_id = auth.uid());

-- ── Equipped skin / animal / archetype helpers ────────────────────────────────
create or replace function public._locker_equipped_skin(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select si.slug
      from public.user_inventory ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = p_user_id
        and ui.is_equipped
        and si.kind = 'skin'
      limit 1
    ),
    'default-oracle'
  );
$$;

create or replace function public._locker_animal_for_skin(p_skin text)
returns text
language sql
immutable
as $$
  select case p_skin
    when 'default-oracle' then 'fox'
    when 'oracle-sage' then 'raven'
    when 'oracle-lunar' then 'stag'
    when 'oracle-solar' then 'phoenix'
    when 'neon-seer' then 'mantis'
    when 'void-prophet' then 'wolf'
    when 'cosmic-oracle' then 'dragon'
    when 'ember-knight' then 'tiger'
    when 'frost-walker' then 'serpent'
    when 'storm-titan' then 'bear'
    when 'nebula-ronin' then 'crane'
    when 'blood-moon' then 'bat'
    when 'aurora-sage' then 'owl'
    else 'fox'
  end;
$$;

create or replace function public._locker_archetype_for_skin(p_skin text)
returns text
language sql
immutable
as $$
  select case p_skin
    when 'default-oracle' then 'volatile'
    when 'oracle-solar' then 'volatile'
    when 'ember-knight' then 'volatile'
    when 'oracle-lunar' then 'steady'
    when 'neon-seer' then 'steady'
    when 'frost-walker' then 'steady'
    when 'aurora-sage' then 'steady'
    when 'void-prophet' then 'streak'
    when 'storm-titan' then 'streak'
    when 'oracle-sage' then 'arcane'
    when 'cosmic-oracle' then 'arcane'
    when 'nebula-ronin' then 'arcane'
    when 'blood-moon' then 'arcane'
    else 'steady'
  end;
$$;

create or replace function public._locker_ensure_momentum(p_user_id uuid)
returns public.locker_momentum
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.locker_momentum;
begin
  insert into public.locker_momentum (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.locker_momentum where user_id = p_user_id;
  return v_row;
end;
$$;

create or replace function public._locker_super_active(p_super_until timestamptz)
returns boolean
language sql
immutable
as $$
  select p_super_until is not null and p_super_until > timezone('utc', now());
$$;

create or replace function public._locker_apply_momentum(
  p_user_id uuid,
  p_delta int,
  p_net bigint
)
returns public.locker_momentum
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.locker_momentum;
  v_new int;
begin
  v_row := public._locker_ensure_momentum(p_user_id);
  v_new := greatest(0, least(100, v_row.momentum + p_delta));

  update public.locker_momentum
  set
    momentum = v_new,
    super_until = case
      when v_new >= 100 and not public._locker_super_active(super_until)
        then timezone('utc', now()) + interval '30 seconds'
      else super_until
    end,
    updated_at = timezone('utc', now())
  where user_id = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ── Read momentum (hydrate client) ────────────────────────────────────────────
create or replace function public.get_locker_momentum()
returns table (
  momentum int,
  super_until timestamptz,
  super_active boolean,
  super_seconds_left int,
  case_chain int,
  wheel_chain int,
  affinity_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.locker_momentum;
  v_skin text;
  v_arch text;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  v_row := public._locker_ensure_momentum(v_uid);
  v_skin := public._locker_equipped_skin(v_uid);
  v_arch := public._locker_archetype_for_skin(v_skin);

  return query
  select
    v_row.momentum,
    v_row.super_until,
    public._locker_super_active(v_row.super_until),
    greatest(0, extract(epoch from (v_row.super_until - timezone('utc', now())))::int),
    v_row.case_chain,
    v_row.wheel_chain,
    initcap(v_arch);
end;
$$;

revoke all on function public.get_locker_momentum() from public;
grant execute on function public.get_locker_momentum() to authenticated;

-- Must drop old signatures before changing OUT parameter return types
drop function if exists public.open_locker_crate(bigint);
drop function if exists public.spin_locker_wheel(bigint);

-- ── Mystery crate with affinity + SUPER + momentum ────────────────────────────
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
    v_charge := greatest(50, (p_stake * 0.9)::bigint);
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

  if v_arch = 'arcane' then
    if v_roll < 0.5 then
      v_payout := greatest(10, (p_stake * (0.05 + random() * 0.15))::bigint);
      v_label := 'Arcane fizzle';
    else
      v_payout := (p_stake * (5 + random() * 4))::bigint;
      v_label := 'Legendary jackpot';
      v_jackpot := true;
    end if;
  elsif v_arch = 'volatile' then
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
    if v_roll < 0.40 then
      v_payout := (p_stake * (0.15 + random() * 0.35))::bigint;
      v_label := 'Common drop';
      if v_arch = 'steady' then
        v_payout := greatest(v_payout, (p_stake * 0.5)::bigint);
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
    v_chain_mult := 1.0 + (v_mom.case_chain * 0.1);
    if v_pair = 'storm-titan|bear' then
      v_chain_mult := v_chain_mult * 1.2;
    end if;
    v_payout := (v_payout * v_chain_mult)::bigint;
    v_mult := v_mult * v_chain_mult;
  end if;

  if v_pair = 'frost-walker|serpent' then
    v_payout := (v_payout * 1.15)::bigint;
    v_mult := v_mult * 1.15;
  end if;

  if v_arch = 'volatile' and v_jackpot then
    v_payout := (v_payout * 1.5)::bigint;
    v_mult := v_mult * 1.5;
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

revoke all on function public.open_locker_crate(bigint) from public;
grant execute on function public.open_locker_crate(bigint) to authenticated;

-- ── Wheel spin with affinity + SUPER + momentum ───────────────────────────────
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
  v_arch text;
  v_mom public.locker_momentum;
  v_super boolean;
  v_mult numeric := 1.0;
  v_net bigint;
  v_delta int;
  v_jackpot boolean := false;
  v_chain_mult numeric := 1.0;
  v_segments text[] := array[
    '25 VIBE', '100 VIBE', '50 VIBE', '500 VIBE', '10 VIBE', '250 VIBE',
    '75 VIBE', '1000 VIBE', '15 VIBE', '200 VIBE', '30 VIBE', '2500 JACKPOT'
  ];
  v_payouts bigint[] := array[25, 100, 50, 500, 10, 250, 75, 1000, 15, 200, 30, 2500];
  v_weights numeric[] := array[14, 8, 12, 3, 16, 6, 10, 2, 15, 7, 13, 1];
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
  v_arch := public._locker_archetype_for_skin(v_skin);
  v_super := public._locker_super_active(v_mom.super_until);

  if v_arch = 'arcane' then
    v_weights := array[0, 0, 0, 2, 0, 2, 0, 3, 0, 2, 0, 25];
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
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  if v_cost > 0 then
    select id into v_burn from public.accounts
    where kind = 'system_burn' and currency = 'vibe' and code = 'locker_wheel_burn';
    if v_burn is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'locker_wheel_burn')
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
    v_payout := (v_payout * 1.25)::bigint;
    v_mult := v_mult * 1.25;
  end if;

  if v_arch = 'steady' and v_cost > 0 and v_payout < v_cost then
    v_payout := greatest(v_payout, (v_cost / 2)::bigint);
  end if;

  if v_arch = 'streak' then
    v_chain_mult := 1.0 + (v_mom.wheel_chain * 0.1);
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

revoke all on function public.spin_locker_wheel(bigint) from public;
grant execute on function public.spin_locker_wheel(bigint) to authenticated;
