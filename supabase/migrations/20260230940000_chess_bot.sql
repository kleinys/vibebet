-- Friendly chess vs platform bot + bot move application.

create or replace function public.get_platform_bot_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public._platform_bot_id();
$$;

revoke all on function public.get_platform_bot_id() from public;
grant execute on function public.get_platform_bot_id() to authenticated;

create or replace function public.start_chess_vs_bot(
  p_friendly boolean default true,
  p_stake bigint default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bot_id  uuid;
  v_id      uuid;
  v_stake   bigint;
  v_friendly boolean := coalesce(p_friendly, true);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  if v_stake > 0 then
    perform public._fund_platform_bot(greatest(v_stake * 4, 1000));
  end if;

  insert into public.chess_games (
    creator_id,
    opponent_id,
    stake,
    is_friendly,
    status,
    current_turn_id,
    move_count,
    fen
  ) values (
    v_user_id,
    v_bot_id,
    v_stake,
    v_friendly,
    'matched',
    v_user_id,
    0,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  ) returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'chess_bot_create', 'chess_bot:' || v_id::text,
      public._chess_escrow_code(v_id), jsonb_build_object('chess_id', v_id, 'vs_bot', true)
    );
    perform public._debit_wallet_to_escrow(
      v_bot_id, v_stake, 'chess_bot_join', 'chess_bot_join:' || v_id::text,
      public._chess_escrow_code(v_id), jsonb_build_object('chess_id', v_id, 'vs_bot', true)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.apply_chess_state_for_bot(
  p_game_id       uuid,
  p_fen           text,
  p_next_turn_id  uuid,
  p_status        text,
  p_winner_id     uuid,
  p_result        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_bot_id       uuid;
  v_game         public.chess_games%rowtype;
  v_new_count    int;
  v_new_status   text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot missing'; end if;

  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_bot_id then raise exception 'not bot turn'; end if;
  if v_user_id <> v_game.creator_id and v_user_id <> v_game.opponent_id then
    raise exception 'not a participant';
  end if;
  if v_game.creator_id <> v_bot_id and v_game.opponent_id <> v_bot_id then
    raise exception 'not a bot game';
  end if;

  v_new_count := v_game.move_count + 1;
  v_new_status := case when v_new_count >= 2 then 'active' else 'matched' end;

  if p_status = 'active' then
    update public.chess_games
    set fen = p_fen,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = v_new_status,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;

    if v_new_status = 'active' and v_game.move_count < 2 then
      perform public._create_skill_spectator_market('chess', p_game_id);
    end if;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._chess_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'chess', true, 'chess_settle', 'chess:' || p_game_id::text,
      jsonb_build_object('chess_id', p_game_id, 'vs_bot', true)
    );
    perform public._resolve_skill_spectator_market('chess', p_game_id, null);
    update public.chess_games
    set fen = p_fen, status = 'draw', current_turn_id = null, result_reason = coalesce(p_result, 'draw'),
        settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  if p_status = 'settled' and p_winner_id is not null then
    perform public._settle_skill_duel(
      public._chess_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
      jsonb_build_object('chess_id', p_game_id, 'result', p_result, 'vs_bot', true)
    );
    perform public._resolve_skill_spectator_market('chess', p_game_id, p_winner_id);
    update public.chess_games
    set fen = p_fen, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
        result_reason = coalesce(p_result, 'checkmate'), settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  raise exception 'invalid bot chess status';
end;
$$;

revoke all on function public.start_chess_vs_bot(boolean, bigint) from public;
grant execute on function public.start_chess_vs_bot(boolean, bigint) to authenticated;
revoke all on function public.apply_chess_state_for_bot(uuid, text, uuid, text, uuid, text) from public;
grant execute on function public.apply_chess_state_for_bot(uuid, text, uuid, text, uuid, text) to authenticated;
