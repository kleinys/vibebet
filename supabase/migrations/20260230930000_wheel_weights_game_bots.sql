-- Slightly tighten high-tier wheel odds + instant luck duels vs platform bot.

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
  v_weights numeric[] := array[14, 8, 12, 2.5, 16, 6, 10, 1.5, 15, 7, 13, 0.85];
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

create or replace function public._platform_bot_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select (value #>> '{}')::uuid from public.app_config where key = 'platform_bot_user_id';
$$;

revoke all on function public._platform_bot_id() from public;

create or replace function public.play_rps_vs_bot(
  p_stake bigint,
  p_move  text
)
returns table (
  creator_move  text,
  opponent_move text,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_bot_id    uuid;
  v_bot_move  text;
  v_id        uuid;
  v_result    int;
  v_winner_id uuid;
  v_pool      bigint;
  v_payout    bigint;
  v_winner_wallet uuid;
  v_mint      uuid;
  v_escrow    uuid;
  v_tx_id     uuid;
  v_moves     text[] := array['rock', 'paper', 'scissors'];
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_move not in ('rock', 'paper', 'scissors') then raise exception 'pick rock, paper, or scissors'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_bot_move := v_moves[1 + floor(random() * 3)::int];
  v_result := public._rps_winner(p_move, v_bot_move);
  if v_result = 1 then v_winner_id := v_user_id;
  elsif v_result = -1 then v_winner_id := v_bot_id;
  else v_winner_id := null;
  end if;

  insert into public.rps_duels (
    creator_id, opponent_id, stake, creator_move, opponent_move, status, winner_id, settled_at
  ) values (
    v_user_id, v_bot_id, p_stake, p_move, v_bot_move, 'settled', v_winner_id, now()
  ) returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'rps_bot_create', 'rps_bot:' || v_id::text,
    public._rps_escrow_code(v_id),
    jsonb_build_object('rps_duel_id', v_id, 'vs_bot', true)
  );
  perform public._debit_wallet_to_escrow(
    v_bot_id, p_stake, 'rps_bot_join', 'rps_bot_join:' || v_id::text,
    public._rps_escrow_code(v_id),
    jsonb_build_object('rps_duel_id', v_id, 'vs_bot', true)
  );

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
  where kind = 'system_burn' and currency = 'vibe' and code = public._rps_escrow_code(v_id);

  if v_winner_id is not null then
    select public._wallet_for_user(v_winner_id) into v_winner_wallet;
    select id into v_mint from public.accounts
    where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_settle', 'rps_bot_settle:' || v_id::text,
      jsonb_build_object('rps_duel_id', v_id, 'winner_id', v_winner_id, 'vs_bot', true), v_winner_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
  else
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_draw', 'rps_bot_draw:' || v_id::text,
      jsonb_build_object('rps_duel_id', v_id, 'vs_bot', true), v_user_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_user_id), p_stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_bot_id), p_stake, 'vibe');
  end if;

  return query
  select p_move, v_bot_move, v_winner_id, coalesce(v_payout, 0::bigint), 'Platform Bot'::text;
end;
$$;

create or replace function public.play_high_card_vs_bot(p_stake bigint)
returns table (
  creator_card  int,
  opponent_card int,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_bot_id        uuid;
  v_id            uuid;
  v_c_card        int;
  v_o_card        int;
  v_winner_id     uuid;
  v_pool          bigint;
  v_payout        bigint;
  v_winner_wallet uuid;
  v_mint          uuid;
  v_escrow        uuid;
  v_tx_id         uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_c_card := floor(random() * 13 + 1)::int;
  v_o_card := floor(random() * 13 + 1)::int;

  if v_c_card > v_o_card then v_winner_id := v_user_id;
  elsif v_o_card > v_c_card then v_winner_id := v_bot_id;
  else
    v_c_card := floor(random() * 13 + 1)::int;
    v_o_card := floor(random() * 13 + 1)::int;
    if v_c_card >= v_o_card then v_winner_id := v_user_id;
    else v_winner_id := v_bot_id;
    end if;
  end if;

  insert into public.high_card_duels (
    creator_id, opponent_id, stake, creator_card, opponent_card, status, winner_id, settled_at
  ) values (
    v_user_id, v_bot_id, p_stake, v_c_card, v_o_card, 'settled', v_winner_id, now()
  ) returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'high_card_bot_create', 'hc_bot:' || v_id::text,
    public._high_card_escrow_code(v_id),
    jsonb_build_object('high_card_duel_id', v_id, 'vs_bot', true)
  );
  perform public._debit_wallet_to_escrow(
    v_bot_id, p_stake, 'high_card_bot_join', 'hc_bot_join:' || v_id::text,
    public._high_card_escrow_code(v_id),
    jsonb_build_object('high_card_duel_id', v_id, 'vs_bot', true)
  );

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
  where kind = 'system_burn' and currency = 'vibe' and code = public._high_card_escrow_code(v_id);
  select public._wallet_for_user(v_winner_id) into v_winner_wallet;
  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('high_card_settle', 'hc_bot_settle:' || v_id::text,
    jsonb_build_object('high_card_duel_id', v_id, 'winner_id', v_winner_id, 'vs_bot', true), v_winner_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query
  select v_c_card, v_o_card, v_winner_id, v_payout, 'Platform Bot'::text;
end;
$$;

create or replace function public.play_dice_vs_bot(p_stake bigint)
returns table (
  creator_roll  int,
  opponent_roll int,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_bot_id        uuid;
  v_id            uuid;
  v_c_roll        int;
  v_o_roll        int;
  v_winner_id     uuid;
  v_pool          bigint;
  v_payout        bigint;
  v_winner_wallet uuid;
  v_mint          uuid;
  v_escrow        uuid;
  v_tx_id         uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
  v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;

  if v_c_roll > v_o_roll then v_winner_id := v_user_id;
  elsif v_o_roll > v_c_roll then v_winner_id := v_bot_id;
  else
    v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    if v_c_roll >= v_o_roll then v_winner_id := v_user_id;
    else v_winner_id := v_bot_id;
    end if;
  end if;

  insert into public.dice_duels (
    creator_id, opponent_id, stake, creator_roll, opponent_roll, status, winner_id, settled_at
  ) values (
    v_user_id, v_bot_id, p_stake, v_c_roll, v_o_roll, 'settled', v_winner_id, now()
  ) returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'dice_bot_create', 'dice_bot:' || v_id::text,
    public._dice_escrow_code(v_id),
    jsonb_build_object('dice_duel_id', v_id, 'vs_bot', true)
  );
  perform public._debit_wallet_to_escrow(
    v_bot_id, p_stake, 'dice_bot_join', 'dice_bot_join:' || v_id::text,
    public._dice_escrow_code(v_id),
    jsonb_build_object('dice_duel_id', v_id, 'vs_bot', true)
  );

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
  where kind = 'system_burn' and currency = 'vibe' and code = public._dice_escrow_code(v_id);
  select public._wallet_for_user(v_winner_id) into v_winner_wallet;
  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('dice_duel_settle', 'dice_bot_settle:' || v_id::text,
    jsonb_build_object('dice_duel_id', v_id, 'winner_id', v_winner_id, 'vs_bot', true), v_winner_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query
  select v_c_roll, v_o_roll, v_winner_id, v_payout, 'Platform Bot'::text;
end;
$$;

revoke all on function public.play_rps_vs_bot(bigint, text) from public;
grant execute on function public.play_rps_vs_bot(bigint, text) to authenticated;
revoke all on function public.play_high_card_vs_bot(bigint) from public;
grant execute on function public.play_high_card_vs_bot(bigint) to authenticated;
revoke all on function public.play_dice_vs_bot(bigint) from public;
grant execute on function public.play_dice_vs_bot(bigint) to authenticated;
