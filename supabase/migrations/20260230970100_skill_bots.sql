-- Skill-board vs-bot starters (requires duel game tables from phase 31–34 migrations).
-- Skip safely if tables missing — run after connect4/checkers/go/shogi/poker migrations exist.

-- Connect Four
create or replace function public.start_connect4_vs_bot(
  p_friendly boolean default true,
  p_stake bigint default 100
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_stake bigint;
  v_friendly boolean := coalesce(p_friendly, true);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  if v_stake > 0 then perform public._fund_platform_bot(greatest(v_stake * 4, 1000)); end if;
  insert into public.connect4_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id, board, move_count)
  values (v_user_id, v_bot_id, v_stake, v_friendly, 'active', v_user_id, array_fill(0, array[42])::int[], 0) returning id into v_id;
  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'connect4_bot_create', 'c4_bot:' || v_id::text, public._connect4_escrow_code(v_id), jsonb_build_object('connect4_id', v_id, 'vs_bot', true));
    perform public._debit_wallet_to_escrow(v_bot_id, v_stake, 'connect4_bot_join', 'c4_bot_join:' || v_id::text, public._connect4_escrow_code(v_id), jsonb_build_object('connect4_id', v_id, 'vs_bot', true));
  end if;
  return v_id;
end; $$;

create or replace function public.play_connect4_bot_move(p_game_id uuid)
returns table (winner_id uuid, is_draw boolean, col_played int)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid;
  v_game public.connect4_games%rowtype;
  v_col int; v_row int; v_ok boolean; v_piece int; v_winner uuid;
  v_pool bigint; v_payout bigint; v_wallet uuid; v_mint uuid; v_escrow uuid; v_tx_id uuid; v_loser uuid;
  v_cols int[] := array[]::int[]; c int;
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
  if public._connect4_check_win(v_game.board, v_piece) then v_winner := v_bot_id;
  elsif public._connect4_board_full(v_game.board) then v_winner := null;
  else
    update public.connect4_games set board = v_game.board, move_count = move_count + 1,
      current_turn_id = case when v_bot_id = creator_id then opponent_id else creator_id end
    where id = p_game_id;
    return query select null::uuid, false, v_col;
    return;
  end if;
  v_pool := v_game.stake * 2; v_payout := floor(v_pool * 0.9)::bigint;
  if v_game.stake > 0 then
    select id into v_escrow from public.accounts where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = public._connect4_escrow_code(p_game_id);
    if v_winner is not null then
      select public._wallet_for_user(v_winner) into v_wallet;
      select id into v_mint from public.accounts where kind = 'system_mint'::account_kind and currency = 'vibe'::currency and code = 'vibe_mint';
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('connect4_settle', 'c4_bot_settle:' || p_game_id::text, jsonb_build_object('connect4_id', p_game_id, 'winner_id', v_winner, 'vs_bot', true), v_winner)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
    else
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('connect4_draw', 'c4_bot_draw:' || p_game_id::text, jsonb_build_object('connect4_id', p_game_id, 'vs_bot', true), v_game.creator_id)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_game.creator_id), v_game.stake, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_game.opponent_id), v_game.stake, 'vibe');
    end if;
  end if;
  if v_winner is not null then
    v_loser := case when v_winner = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
    if not v_game.is_friendly then perform public._apply_game_rating('connect4', v_winner, v_loser, false); end if;
    update public.connect4_games set board = v_game.board, status = 'settled', winner_id = v_winner,
      current_turn_id = null, settled_at = now(), move_count = move_count + 1 where id = p_game_id;
    return query select v_winner, false, v_col;
  else
    update public.connect4_games set board = v_game.board, status = 'draw', winner_id = null,
      current_turn_id = null, settled_at = now(), move_count = move_count + 1 where id = p_game_id;
    return query select null::uuid, true, v_col;
  end if;
end; $$;

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
  p_state jsonb, p_friendly boolean default true, p_stake bigint default 100
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
