-- More vs-bot starters, instant luck bots, Plinko, lucky slots + scratcher tickets.

-- ── Connect Four vs bot ──
create or replace function public.start_connect4_vs_bot(
  p_friendly boolean default true,
  p_stake bigint default 100
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_bot_id  uuid;
  v_id      uuid;
  v_stake   bigint;
  v_friendly boolean := coalesce(p_friendly, true);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;

  insert into public.connect4_games (
    creator_id, opponent_id, stake, is_friendly, status, current_turn_id, board, move_count
  ) values (
    v_user_id, v_bot_id, v_stake, v_friendly, 'active', v_user_id,
    array_fill(0, array[42])::int[], 0
  ) returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'connect4_bot_create', 'c4_bot:' || v_id::text,
      public._connect4_escrow_code(v_id), jsonb_build_object('connect4_id', v_id, 'vs_bot', true));
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'connect4_bot_join', 'c4_bot_join:' || v_id::text,
      public._connect4_escrow_code(v_id), jsonb_build_object('connect4_id', v_id, 'vs_bot', true));
  end if;

  return v_id;
end;
$$;

create or replace function public.play_connect4_bot_move(p_game_id uuid)
returns table (winner_id uuid, is_draw boolean, col_played int)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id   uuid := auth.uid();
  v_bot_id    uuid;
  v_game      public.connect4_games%rowtype;
  v_col       int;
  v_row       int;
  v_ok        boolean;
  v_piece     int;
  v_winner    uuid;
  v_pool      bigint;
  v_payout    bigint;
  v_wallet    uuid;
  v_mint      uuid;
  v_escrow    uuid;
  v_tx_id     uuid;
  v_loser     uuid;
  v_cols      int[] := array[]::int[];
  c           int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot missing'; end if;

  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_bot_id then raise exception 'not bot turn'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a participant'; end if;

  for c in 0..6 loop
    select r.ok into v_ok from public._connect4_col_row(v_game.board, c) r;
    if v_ok then v_cols := array_append(v_cols, c); end if;
  end loop;
  if array_length(v_cols, 1) is null then raise exception 'board full'; end if;

  v_col := v_cols[1 + floor(random() * array_length(v_cols, 1))::int];
  select r.row_idx, r.ok into v_row, v_ok from public._connect4_col_row(v_game.board, v_col) r;

  v_piece := case when v_bot_id = v_game.creator_id then 1 else 2 end;
  v_game.board[v_row * 7 + v_col + 1] := v_piece;

  if public._connect4_check_win(v_game.board, v_piece) then
    v_winner := v_bot_id;
  elsif public._connect4_board_full(v_game.board) then
    v_winner := null;
  else
    update public.connect4_games set
      board = v_game.board,
      move_count = move_count + 1,
      current_turn_id = case when v_bot_id = creator_id then opponent_id else creator_id end
    where id = p_game_id;
    return query select null::uuid, false, v_col;
    return;
  end if;

  v_pool := v_game.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  if v_game.stake > 0 then
    select id into v_escrow from public.accounts
    where kind = 'system_burn' and currency = 'vibe' and code = public._connect4_escrow_code(p_game_id);

    if v_winner is not null then
      select public._wallet_for_user(v_winner) into v_wallet;
      select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('connect4_settle', 'c4_bot_settle:' || p_game_id::text,
        jsonb_build_object('connect4_id', p_game_id, 'winner_id', v_winner, 'vs_bot', true), v_winner)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'),
        (v_tx_id, v_wallet, v_payout, 'vibe'),
        (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
    else
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('connect4_draw', 'c4_bot_draw:' || p_game_id::text,
        jsonb_build_object('connect4_id', p_game_id, 'vs_bot', true), v_game.creator_id)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_game.creator_id), v_game.stake, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_game.opponent_id), v_game.stake, 'vibe');
    end if;
  end if;

  if v_winner is not null then
    v_loser := case when v_winner = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
    if not v_game.is_friendly then
      perform public._apply_game_rating('connect4', v_winner, v_loser, false);
    end if;
    update public.connect4_games set board = v_game.board, status = 'settled', winner_id = v_winner,
      current_turn_id = null, settled_at = now(), move_count = move_count + 1 where id = p_game_id;
    return query select v_winner, false, v_col;
  else
    update public.connect4_games set board = v_game.board, status = 'draw', winner_id = null,
      current_turn_id = null, settled_at = now(), move_count = move_count + 1 where id = p_game_id;
    return query select null::uuid, true, v_col;
  end if;
end;
$$;

-- ── Checkers / Go / Shogi / Poker vs bot ──
create or replace function public.start_checkers_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  v_stake := case when coalesce(p_friendly, true) then 0 else p_stake end;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;
  insert into public.checkers_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, v_stake, coalesce(p_friendly, true), 'active', v_user_id) returning id into v_id;
  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'checkers_bot', 'chk_bot:' || v_id::text, public._checkers_escrow_code(v_id), '{}');
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'checkers_bot_join', 'chk_bot_j:' || v_id::text, public._checkers_escrow_code(v_id), '{}');
  end if;
  return v_id;
end; $$;

create or replace function public.start_go_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  v_stake := case when coalesce(p_friendly, true) then 0 else p_stake end;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;
  insert into public.go_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, v_stake, coalesce(p_friendly, true), 'active', v_user_id) returning id into v_id;
  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'go_bot', 'go_bot:' || v_id::text, public._go_escrow_code(v_id), '{}');
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'go_bot_join', 'go_bot_j:' || v_id::text, public._go_escrow_code(v_id), '{}');
  end if;
  return v_id;
end; $$;

create or replace function public.start_shogi_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  v_stake := case when coalesce(p_friendly, true) then 0 else p_stake end;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;
  insert into public.shogi_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, v_stake, coalesce(p_friendly, true), 'active', v_user_id) returning id into v_id;
  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'shogi_bot', 'shogi_bot:' || v_id::text, public._shogi_escrow_code(v_id), '{}');
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'shogi_bot_join', 'shogi_bot_j:' || v_id::text, public._shogi_escrow_code(v_id), '{}');
  end if;
  return v_id;
end; $$;

create or replace function public.start_poker_vs_bot(
  p_state jsonb,
  p_friendly boolean default true,
  p_stake bigint default 100
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_state is null then raise exception 'poker state required'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  v_stake := case when coalesce(p_friendly, true) then 0 else p_stake end;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;
  insert into public.poker_games (creator_id, opponent_id, stake, is_friendly, status, state)
  values (v_user_id, v_bot_id, v_stake, coalesce(p_friendly, true), 'active', p_state) returning id into v_id;
  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'poker_bot', 'poker_bot:' || v_id::text, public._poker_escrow_code(v_id), '{}');
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'poker_bot_join', 'poker_bot_j:' || v_id::text, public._poker_escrow_code(v_id), '{}');
  end if;
  return v_id;
end; $$;

-- ── Instant luck bots ──
create or replace function public.play_trivia_vs_bot(p_stake bigint default 50)
returns table (your_score int, bot_score int, winner_id uuid, payout bigint, bot_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_y int; v_b int; v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_y := floor(random() * 6)::int;
  v_b := floor(random() * 6)::int;
  if v_y > v_b then v_winner := v_user_id;
  elsif v_b > v_y then v_winner := v_bot_id;
  else v_winner := case when random() < 0.5 then v_user_id else v_bot_id end;
  end if;

  insert into public.trivia_duels (creator_id, opponent_id, stake, creator_score, opponent_score, status, winner_id, settled_at)
  values (v_user_id, v_bot_id, p_stake, v_y, v_b, 'settled', v_winner, now()) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'trivia_bot', 'trivia_bot:' || v_id::text, public._trivia_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'trivia_bot_join', 'trivia_bot_j:' || v_id::text, public._trivia_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn' and currency = 'vibe' and code = public._trivia_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('trivia_settle', 'trivia_bot_settle:' || v_id::text, jsonb_build_object('trivia_duel_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_y, v_b, v_winner, v_payout, 'Platform Bot'::text;
end; $$;

create or replace function public.play_liars_dice_vs_bot(p_stake bigint default 50)
returns table (winner_id uuid, payout bigint, bot_name text, you_won boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_winner := case when random() < 0.48 then v_user_id else v_bot_id end;

  insert into public.liars_dice_games (creator_id, opponent_id, stake, status, winner_id, settled_at, is_friendly)
  values (v_user_id, v_bot_id, p_stake, 'settled', v_winner, now(), false) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'liars_bot', 'liars_bot:' || v_id::text, public._liars_dice_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'liars_bot_join', 'liars_bot_j:' || v_id::text, public._liars_dice_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn' and currency = 'vibe' and code = public._liars_dice_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('liars_dice_settle', 'liars_bot_settle:' || v_id::text, jsonb_build_object('liars_dice_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_winner, v_payout, 'Platform Bot'::text, v_winner = v_user_id;
end; $$;

create or replace function public.play_lightning_duel_vs_bot(
  p_stake bigint default 50,
  p_side text default 'up'
)
returns table (winner_id uuid, payout bigint, bot_name text, strike_price numeric, settle_price numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
  v_strike numeric := 60000 + floor(random() * 20000);
  v_settle numeric;
  v_bot_side text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  if p_side not in ('up', 'down') then raise exception 'side must be up or down'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_settle := v_strike + (random() * 400 - 200);
  v_bot_side := case when p_side = 'up' then 'down' else 'up' end;
  if (p_side = 'up' and v_settle > v_strike) or (p_side = 'down' and v_settle < v_strike) then
    v_winner := v_user_id;
  elsif v_settle = v_strike then
    v_winner := case when random() < 0.5 then v_user_id else v_bot_id end;
  else
    v_winner := v_bot_id;
  end if;

  insert into public.lightning_duels (
    creator_id, opponent_id, stake, creator_side, duration_sec,
    strike_price, end_price, status, winner_id, settled_at, is_friendly
  ) values (
    v_user_id, v_bot_id, p_stake, p_side, 60,
    v_strike, v_settle, 'settled', v_winner, now(), false
  ) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'lightning_bot', 'lt_bot:' || v_id::text, public._lightning_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'lightning_bot_join', 'lt_bot_j:' || v_id::text, public._lightning_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn' and currency = 'vibe' and code = public._lightning_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('lightning_duel_settle', 'lt_bot_settle:' || v_id::text, jsonb_build_object('lightning_duel_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_winner, v_payout, 'Platform Bot'::text, v_strike, v_settle;
end; $$;

-- ── Plinko ──
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
    v_slots := array[0.5, 0.8, 1.0, 1.2, 1.5, 1.2, 1.0, 0.8, 0.5];
    v_weights := array[12, 14, 16, 14, 8, 14, 16, 14, 12];
  elsif p_risk = 'high' then
    v_slots := array[0.2, 0.5, 1.0, 2.0, 5.0, 2.0, 1.0, 0.5, 0.2];
    v_weights := array[18, 16, 14, 10, 4, 10, 14, 16, 18];
  else
    v_slots := array[0.3, 0.7, 1.0, 1.5, 3.0, 1.5, 1.0, 0.7, 0.3];
    v_weights := array[14, 14, 16, 12, 6, 12, 16, 14, 14];
  end if;

  for v_i in 1..array_length(v_weights, 1) loop v_total := v_total + v_weights[v_i]; end loop;
  v_pick := random() * v_total;
  v_total := 0;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then v_idx := v_i; exit; end if;
  end loop;
  v_mult := v_slots[v_idx];
  v_payout := floor(p_stake * v_mult)::bigint;
  v_net := v_payout - p_stake;

  select public._wallet_for_user(v_user_id) into v_wallet;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then raise exception 'insufficient VIBE'; end if;

  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  select id into v_burn from public.accounts where kind = 'system_burn' and currency = 'vibe' and code = 'plinko_burn';
  if v_burn is null then
    insert into public.accounts (kind, currency, code) values ('system_burn', 'vibe', 'plinko_burn') returning id into v_burn;
  end if;

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

-- ── Lucky slots + scratcher tickets ──
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

create or replace function public.spin_lucky_slots(p_stake bigint default 50)
returns table (
  reel1 text, reel2 text, reel3 text,
  line_payout bigint, scratcher_won boolean, ticket_id uuid,
  net bigint, new_balance bigint
)
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
      values (v_user_id, floor(p_stake * (2 + random() * 8))::bigint)
      returning id into v_ticket;
      v_payout := 0;
    else v_payout := p_stake * 3;
    end if;
  elsif v_r1 = v_r2 or v_r2 = v_r3 or v_r1 = v_r3 then
    v_payout := floor(p_stake * 1.5)::bigint;
  end if;

  v_net := v_payout - p_stake;
  select public._wallet_for_user(v_user_id) into v_wallet;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then raise exception 'insufficient VIBE'; end if;

  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  select id into v_burn from public.accounts where kind = 'system_burn' and currency = 'vibe' and code = 'lucky_slots_burn';
  if v_burn is null then
    insert into public.accounts (kind, currency, code) values ('system_burn', 'vibe', 'lucky_slots_burn') returning id into v_burn;
  end if;

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
  select id into v_mint from public.accounts where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

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
  where user_id = auth.uid() and revealed = false
  order by created_at desc;
$$;

-- Grants
revoke all on function public.start_connect4_vs_bot(boolean, bigint) from public;
grant execute on function public.start_connect4_vs_bot(boolean, bigint) to authenticated;
revoke all on function public.play_connect4_bot_move(uuid) from public;
grant execute on function public.play_connect4_bot_move(uuid) to authenticated;
revoke all on function public.start_checkers_vs_bot(boolean, bigint) from public;
grant execute on function public.start_checkers_vs_bot(boolean, bigint) to authenticated;
revoke all on function public.start_go_vs_bot(boolean, bigint) from public;
grant execute on function public.start_go_vs_bot(boolean, bigint) to authenticated;
revoke all on function public.start_shogi_vs_bot(boolean, bigint) from public;
grant execute on function public.start_shogi_vs_bot(boolean, bigint) to authenticated;
revoke all on function public.start_poker_vs_bot(jsonb, boolean, bigint) from public;
grant execute on function public.start_poker_vs_bot(jsonb, boolean, bigint) to authenticated;
revoke all on function public.play_trivia_vs_bot(bigint) from public;
grant execute on function public.play_trivia_vs_bot(bigint) to authenticated;
revoke all on function public.play_liars_dice_vs_bot(bigint) from public;
grant execute on function public.play_liars_dice_vs_bot(bigint) to authenticated;
revoke all on function public.play_lightning_duel_vs_bot(bigint, text) from public;
grant execute on function public.play_lightning_duel_vs_bot(bigint, text) to authenticated;
revoke all on function public.play_plinko(bigint, text) from public;
grant execute on function public.play_plinko(bigint, text) to authenticated;
revoke all on function public.spin_lucky_slots(bigint) from public;
grant execute on function public.spin_lucky_slots(bigint) to authenticated;
revoke all on function public.reveal_lucky_scratcher(uuid) from public;
grant execute on function public.reveal_lucky_scratcher(uuid) to authenticated;
revoke all on function public.get_pending_scratchers() from public;
grant execute on function public.get_pending_scratchers() to authenticated;
