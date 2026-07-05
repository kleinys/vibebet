-- Fix vs-bot duplicate escrow accounts, bootstrap locker prerequisites, safe re-apply of failed migrations.
-- Run this in Supabase SQL Editor if piecemeal migrations failed.

-- ── 1. Idempotent system account helper ───────────────────────────────────────
create or replace function public._ensure_system_account(
  p_kind text,
  p_currency text,
  p_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.accounts
  where kind = p_kind and currency = p_currency and code = p_code;

  if v_id is not null then return v_id; end if;

  begin
    insert into public.accounts (kind, currency, code)
    values (p_kind, p_currency, p_code)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id
    from public.accounts
    where kind = p_kind and currency = p_currency and code = p_code;
  end;

  return v_id;
end;
$$;

revoke all on function public._ensure_system_account(text, text, text) from public;

-- ── 2. Fix escrow debit (second player / bot join was hitting accounts_system_unique) ──
create or replace function public._debit_wallet_to_escrow(
  p_user_id     uuid,
  p_amount      bigint,
  p_kind        text,
  p_external    text,
  p_escrow_code text,
  p_metadata    jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet  uuid;
  v_escrow  uuid;
  v_balance bigint;
  v_tx_id   uuid;
begin
  select public._wallet_for_user(p_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_amount then
    raise exception 'insufficient VIBE: need %, have %', p_amount, v_balance;
  end if;

  v_escrow := public._ensure_system_account('system_burn', 'vibe', p_escrow_code);
  if v_escrow is null then raise exception 'escrow account missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_kind, p_external, p_metadata, p_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_amount, 'vibe'),
    (v_tx_id, v_escrow,  p_amount, 'vibe');

  return v_tx_id;
end;
$$;

-- ── 3. Fix platform bot funding (race-safe vibe_mint) ─────────────────────────
create or replace function public._fund_platform_bot(p_amount bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot_id  uuid;
  v_wallet  uuid;
  v_mint    uuid;
  v_tx_id   uuid;
  v_balance bigint;
begin
  select (value #>> '{}')::uuid into v_bot_id
  from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then return; end if;

  select id into v_wallet
  from public.accounts
  where owner_user_id = v_bot_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then return; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance >= 2000 then return; end if;

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  if v_mint is null then return; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'platform_bot_fund',
    'platform_bot_fund:' || gen_random_uuid()::text,
    jsonb_build_object('amount', p_amount, 'bot_id', v_bot_id),
    null
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_mint,   -p_amount, 'vibe'),
    (v_tx_id, v_wallet,  p_amount, 'vibe');
end;
$$;

-- ── 4. Locker momentum prerequisites (needed by spin_locker_wheel) ─────────────
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

create table if not exists public.locker_wheel_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_date date not null,
  spins_used int not null default 0,
  primary key (user_id, spin_date)
);

alter table public.locker_wheel_daily enable row level security;
drop policy if exists locker_wheel_daily_select on public.locker_wheel_daily;
create policy locker_wheel_daily_select on public.locker_wheel_daily
  for select to authenticated using (user_id = auth.uid());

create or replace function public._locker_equipped_skin(p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select si.slug
      from public.user_inventory ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = p_user_id and ui.is_equipped and si.kind = 'skin'
      limit 1
    ),
    'default-oracle'
  );
$$;

create or replace function public._locker_archetype_for_skin(p_skin text)
returns text language sql immutable as $$
  select case coalesce(p_skin, 'default-oracle')
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
language plpgsql security definer set search_path = public as $$
declare v_row public.locker_momentum;
begin
  insert into public.locker_momentum (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_row from public.locker_momentum where user_id = p_user_id;
  return v_row;
end;
$$;

create or replace function public._locker_super_active(p_super_until timestamptz)
returns boolean language sql immutable as $$
  select p_super_until is not null and p_super_until > timezone('utc', now());
$$;

create or replace function public._locker_apply_momentum(p_user_id uuid, p_delta int, p_net bigint)
returns public.locker_momentum
language plpgsql security definer set search_path = public as $$
declare v_row public.locker_momentum; v_new int;
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

-- ── 5. Wheel with restored wedge weights (500/1000/2500 wider) ────────────────
drop function if exists public.spin_locker_wheel(bigint);

create or replace function public.spin_locker_wheel(p_paid_stake bigint default 100)
returns table (
  segment_index int, label text, payout bigint, cost bigint, net bigint, new_balance bigint,
  free_spin boolean, momentum int, momentum_delta int, super_active boolean,
  super_seconds_left int, payout_multiplier numeric, affinity_label text, is_jackpot boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet uuid; v_mint uuid; v_burn uuid; v_tx_id uuid;
  v_balance bigint; v_cost bigint := 0; v_free boolean := false; v_spins int := 0;
  v_today date := (timezone('utc', now()))::date;
  v_roll numeric; v_idx int; v_payout bigint; v_label text; v_ref text;
  v_skin text; v_arch text; v_mom public.locker_momentum;
  v_super boolean; v_mult numeric := 1.0; v_net bigint; v_delta int;
  v_jackpot boolean := false; v_chain_mult numeric := 1.0;
  v_segments text[] := array[
    '25 VIBE', '100 VIBE', '50 VIBE', '500 VIBE', '10 VIBE', '250 VIBE',
    '75 VIBE', '1000 VIBE', '15 VIBE', '200 VIBE', '30 VIBE', '2500 JACKPOT'
  ];
  v_payouts bigint[] := array[25, 100, 50, 500, 10, 250, 75, 1000, 15, 200, 30, 2500];
  v_weights numeric[] := array[14, 8, 12, 3, 16, 6, 10, 2, 15, 7, 13, 1];
  v_total numeric := 0; v_pick numeric; v_i int;
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

  if v_spins = 0 then v_free := true; v_cost := 0; else v_cost := p_paid_stake; end if;

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance < v_cost then
    raise exception 'insufficient VIBE: need %, have %', v_cost, v_balance;
  end if;

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  if v_mint is null then raise exception 'mint missing'; end if;

  if v_cost > 0 then
    v_burn := public._ensure_system_account('system_burn', 'vibe', 'locker_wheel_burn');
    if v_burn is null then raise exception 'burn account missing'; end if;
  end if;

  v_roll := random();
  for v_i in 1..array_length(v_weights, 1) loop v_total := v_total + v_weights[v_i]; end loop;
  v_pick := v_roll * v_total;
  v_total := 0; v_idx := 1;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then v_idx := v_i; exit; end if;
  end loop;

  v_label := v_segments[v_idx];
  v_payout := v_payouts[v_idx];
  if v_idx = 12 then v_jackpot := true; end if;
  if v_payout >= 500 then v_jackpot := true; end if;

  if v_arch = 'volatile' and v_payout >= 250 then
    v_payout := (v_payout * 1.25)::bigint; v_mult := v_mult * 1.25;
  end if;
  if v_arch = 'steady' and v_cost > 0 and v_payout < v_cost then
    v_payout := greatest(v_payout, (v_cost / 2)::bigint);
  end if;
  if v_arch = 'streak' then
    v_chain_mult := 1.0 + (v_mom.wheel_chain * 0.1);
    v_payout := (v_payout * v_chain_mult)::bigint; v_mult := v_mult * v_chain_mult;
  end if;
  if v_super and v_jackpot then v_payout := v_payout * 2; v_mult := v_mult * 2; end if;

  v_ref := 'locker_wheel:' || gen_random_uuid()::text;
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('locker_wheel', v_ref, jsonb_build_object(
    'segment', v_idx, 'label', v_label, 'payout', v_payout, 'cost', v_cost,
    'free_spin', v_free, 'archetype', v_arch, 'super', v_super, 'multiplier', v_mult, 'jackpot', v_jackpot
  ), v_user_id) returning id into v_tx_id;

  if v_cost > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, -v_cost, 'vibe'), (v_tx_id, v_burn, v_cost, 'vibe');
  end if;
  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  insert into public.locker_wheel_daily (user_id, spin_date, spins_used)
  values (v_user_id, v_today, 1)
  on conflict (user_id, spin_date)
  do update set spins_used = public.locker_wheel_daily.spins_used + 1;

  v_net := v_payout - v_cost;
  v_delta := case when v_net >= 0 then 20 else -10 end;
  v_mom := public._locker_apply_momentum(v_user_id, v_delta, v_net);

  update public.locker_momentum
  set wheel_chain = case when v_net >= 0 then wheel_chain + 1 else 0 end,
      case_chain = case when v_net < 0 then 0 else case_chain end,
      updated_at = timezone('utc', now())
  where user_id = v_user_id returning * into v_mom;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;

  return query select v_idx - 1, v_label, v_payout, v_cost, v_net, v_balance, v_free,
    v_mom.momentum, v_delta, public._locker_super_active(v_mom.super_until),
    greatest(0, extract(epoch from (v_mom.super_until - timezone('utc', now())))::int),
    round(v_mult, 2), initcap(v_arch), v_jackpot;
end;
$$;

revoke all on function public.spin_locker_wheel(bigint) from public;
grant execute on function public.spin_locker_wheel(bigint) to authenticated;

-- ── 6. Plinko + lucky slots (no game-table dependencies) ──────────────────────
create table if not exists public.lucky_scratcher_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prize bigint not null default 0,
  revealed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.lucky_scratcher_tickets enable row level security;
drop policy if exists lucky_scratcher_own on public.lucky_scratcher_tickets;
create policy lucky_scratcher_own on public.lucky_scratcher_tickets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6. Plinko + lucky slots (standalone — no duel game tables required) ───────

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
    v_weights := array[12, 14, 16, 14, 8, 14, 16, 14, 12];
    v_slots := array[0.5, 0.8, 1.0, 1.2, 1.5, 1.2, 1.0, 0.8, 0.5];
  elsif p_risk = 'high' then
    v_weights := array[18, 16, 14, 10, 4, 10, 14, 16, 18];
    v_slots := array[0.2, 0.5, 1.0, 2.0, 5.0, 2.0, 1.0, 0.5, 0.2];
  else
    v_weights := array[14, 14, 16, 12, 6, 12, 16, 14, 14];
    v_slots := array[0.3, 0.7, 1.0, 1.5, 3.0, 1.5, 1.0, 0.7, 0.3];
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
    jsonb_build_object('stake', p_stake, 'risk', p_risk, 'slot', v_idx, 'multiplier', v_mult, 'payout', v_payout), v_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'), (v_tx_id, v_burn, p_stake, 'vibe');
  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  return query select v_idx - 1, v_mult, v_payout, v_net, v_balance;
end; $$;

create or replace function public.spin_lucky_slots(p_stake bigint default 50)
returns table (reel1 text, reel2 text, reel3 text, line_payout bigint, scratcher_won boolean, ticket_id uuid, net bigint, new_balance bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_wallet uuid; v_mint uuid; v_burn uuid; v_tx_id uuid;
  v_balance bigint; v_symbols text[] := array['7', 'BAR', 'GEM', 'V', 'SCRATCH'];
  v_r1 text; v_r2 text; v_r3 text; v_payout bigint := 0; v_net bigint;
  v_ticket uuid; v_scratcher boolean := false;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 2000 then raise exception 'stake must be 10–2,000 VIBE'; end if;

  v_r1 := v_symbols[1 + floor(random() * 5)::int];
  v_r2 := v_symbols[1 + floor(random() * 5)::int];
  v_r3 := v_symbols[1 + floor(random() * 5)::int];

  if v_r1 = v_r2 and v_r2 = v_r3 then
    if v_r1 = '7' then v_payout := p_stake * 10;
    elsif v_r1 = 'GEM' then v_payout := p_stake * 5;
    elsif v_r1 = 'SCRATCH' then
      v_scratcher := true;
      insert into public.lucky_scratcher_tickets (user_id, prize)
      values (v_user_id, floor(p_stake * (2 + random() * 8))::bigint) returning id into v_ticket;
    else v_payout := p_stake * 3;
    end if;
  elsif v_r1 = v_r2 or v_r2 = v_r3 or v_r1 = v_r3 then
    v_payout := floor(p_stake * 1.5)::bigint;
  end if;

  v_net := v_payout - p_stake;
  select public._wallet_for_user(v_user_id) into v_wallet;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then raise exception 'insufficient VIBE'; end if;

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  v_burn := public._ensure_system_account('system_burn', 'vibe', 'lucky_slots_burn');

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('lucky_slots', 'lucky_slots:' || gen_random_uuid()::text,
    jsonb_build_object('reels', array[v_r1, v_r2, v_r3], 'payout', v_payout, 'scratcher', v_scratcher), v_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'), (v_tx_id, v_burn, p_stake, 'vibe');
  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  return query select v_r1, v_r2, v_r3, v_payout, v_scratcher, v_ticket, v_net, v_balance;
end; $$;

create or replace function public.reveal_lucky_scratcher(p_ticket_id uuid)
returns table (prize bigint, new_balance bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_ticket public.lucky_scratcher_tickets%rowtype;
  v_wallet uuid; v_mint uuid; v_tx_id uuid; v_balance bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_ticket from public.lucky_scratcher_tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket not found'; end if;
  if v_ticket.user_id <> v_user_id then raise exception 'not your ticket'; end if;
  if v_ticket.revealed then raise exception 'already revealed'; end if;
  update public.lucky_scratcher_tickets set revealed = true where id = p_ticket_id;
  select public._wallet_for_user(v_user_id) into v_wallet;
  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  if v_ticket.prize > 0 then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('lucky_scratcher', 'scratcher:' || p_ticket_id::text, jsonb_build_object('prize', v_ticket.prize), v_user_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_ticket.prize, 'vibe'), (v_tx_id, v_mint, -v_ticket.prize, 'vibe');
  end if;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  return query select v_ticket.prize, v_balance;
end; $$;

create or replace function public.get_pending_scratchers()
returns table (id uuid, prize bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, prize, created_at from public.lucky_scratcher_tickets
  where user_id = auth.uid() and revealed = false order by created_at desc;
$$;

revoke all on function public.play_plinko(bigint, text) from public;
grant execute on function public.play_plinko(bigint, text) to authenticated;
revoke all on function public.spin_lucky_slots(bigint) from public;
grant execute on function public.spin_lucky_slots(bigint) to authenticated;
revoke all on function public.reveal_lucky_scratcher(uuid) from public;
grant execute on function public.reveal_lucky_scratcher(uuid) to authenticated;
revoke all on function public.get_pending_scratchers() from public;
grant execute on function public.get_pending_scratchers() to authenticated;
