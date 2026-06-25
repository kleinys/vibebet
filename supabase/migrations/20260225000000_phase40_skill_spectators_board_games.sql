-- Phase 40: Spectator betting for checkers/go/shogi + fix get_*_game spectator_market_id
-- Also resolve spectator markets on resign/draw paths for chess + connect4.

-- ---------------------------------------------------------------------------
-- Checkers — spectator hooks
-- ---------------------------------------------------------------------------
create or replace function public.apply_checkers_state(
  p_game_id uuid, p_board int[], p_next_turn_id uuid, p_status text, p_winner_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id    uuid := auth.uid();
  v_game       public.checkers_games%rowtype;
  v_new_count  int;
  v_new_status text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;
  v_new_status := case when v_new_count >= 2 then 'active' else 'matched' end;

  if p_status = 'active' then
    update public.checkers_games
    set board = p_board,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = v_new_status,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;

    if v_new_status = 'active' and v_game.move_count < 2 then
      perform public._create_skill_spectator_market('checkers', p_game_id);
    end if;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._checkers_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'checkers', true, 'checkers_settle', 'checkers:' || p_game_id::text,
      jsonb_build_object('checkers_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('checkers', p_game_id, null);
    update public.checkers_games
    set board = p_board, status = 'draw', winner_id = null, current_turn_id = null,
        settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  perform public._settle_skill_duel(
    public._checkers_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'checkers', false, 'checkers_settle', 'checkers:' || p_game_id::text,
    jsonb_build_object('checkers_id', p_game_id)
  );
  perform public._resolve_skill_spectator_market('checkers', p_game_id, p_winner_id);
  update public.checkers_games
  set board = p_board, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
      settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.resign_checkers_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'can only resign after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(
    public._checkers_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'checkers', false, 'checkers_settle', 'checkers:' || p_game_id::text,
    jsonb_build_object('checkers_id', p_game_id, 'reason', 'resignation')
  );
  perform public._resolve_skill_spectator_market('checkers', p_game_id, v_winner);
  update public.checkers_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.accept_checkers_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if v_game.draw_offered_by is null then raise exception 'no draw offer pending'; end if;
  if v_game.draw_offered_by = v_user_id then raise exception 'cannot accept your own draw offer'; end if;
  perform public._settle_skill_duel(
    public._checkers_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'checkers', true, 'checkers_settle', 'checkers:' || p_game_id::text,
    jsonb_build_object('checkers_id', p_game_id, 'reason', 'agreed_draw')
  );
  perform public._resolve_skill_spectator_market('checkers', p_game_id, null);
  update public.checkers_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Go — spectator hooks
-- ---------------------------------------------------------------------------
create or replace function public.apply_go_state(
  p_game_id uuid, p_board int[], p_prev_board int[], p_pass_count int,
  p_next_turn_id uuid, p_status text, p_winner_id uuid,
  p_black_score numeric default null, p_white_score numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id    uuid := auth.uid();
  v_game       public.go_games%rowtype;
  v_new_count  int;
  v_new_status text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;
  v_new_status := case when v_new_count >= 2 then 'active' else 'matched' end;

  if p_status = 'active' then
    update public.go_games
    set board = p_board,
        prev_board = p_prev_board,
        pass_count = p_pass_count,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = v_new_status,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;

    if v_new_status = 'active' and v_game.move_count < 2 then
      perform public._create_skill_spectator_market('go', p_game_id);
    end if;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._go_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'go', true, 'go_settle', 'go:' || p_game_id::text,
      jsonb_build_object('go_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('go', p_game_id, null);
    update public.go_games
    set board = p_board, status = 'draw', winner_id = null, black_score = p_black_score,
        white_score = p_white_score, current_turn_id = null, settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  perform public._settle_skill_duel(
    public._go_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'go', false, 'go_settle', 'go:' || p_game_id::text,
    jsonb_build_object('go_id', p_game_id)
  );
  perform public._resolve_skill_spectator_market('go', p_game_id, p_winner_id);
  update public.go_games
  set board = p_board, status = 'settled', winner_id = p_winner_id, black_score = p_black_score,
      white_score = p_white_score, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.resign_go_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'can only resign after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(
    public._go_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'go', false, 'go_settle', 'go:' || p_game_id::text,
    jsonb_build_object('go_id', p_game_id, 'reason', 'resignation')
  );
  perform public._resolve_skill_spectator_market('go', p_game_id, v_winner);
  update public.go_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.accept_go_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if v_game.draw_offered_by is null then raise exception 'no draw offer pending'; end if;
  if v_game.draw_offered_by = v_user_id then raise exception 'cannot accept your own draw offer'; end if;
  perform public._settle_skill_duel(
    public._go_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'go', true, 'go_settle', 'go:' || p_game_id::text,
    jsonb_build_object('go_id', p_game_id, 'reason', 'agreed_draw')
  );
  perform public._resolve_skill_spectator_market('go', p_game_id, null);
  update public.go_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Shogi — spectator hooks
-- ---------------------------------------------------------------------------
create or replace function public.apply_shogi_state(
  p_game_id uuid, p_sfen text, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_result text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id    uuid := auth.uid();
  v_game       public.shogi_games%rowtype;
  v_new_count  int;
  v_new_status text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;
  v_new_status := case when v_new_count >= 2 then 'active' else 'matched' end;

  if p_status = 'active' then
    update public.shogi_games
    set sfen = p_sfen,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = v_new_status,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;

    if v_new_status = 'active' and v_game.move_count < 2 then
      perform public._create_skill_spectator_market('shogi', p_game_id);
    end if;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._shogi_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'shogi', true, 'shogi_settle', 'shogi:' || p_game_id::text,
      jsonb_build_object('shogi_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('shogi', p_game_id, null);
    update public.shogi_games
    set sfen = p_sfen, status = 'draw', winner_id = null, current_turn_id = null,
        result_reason = p_result, settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  perform public._settle_skill_duel(
    public._shogi_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'shogi', false, 'shogi_settle', 'shogi:' || p_game_id::text,
    jsonb_build_object('shogi_id', p_game_id)
  );
  perform public._resolve_skill_spectator_market('shogi', p_game_id, p_winner_id);
  update public.shogi_games
  set sfen = p_sfen, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
      result_reason = p_result, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.resign_shogi_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'can only resign after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(
    public._shogi_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'shogi', false, 'shogi_settle', 'shogi:' || p_game_id::text,
    jsonb_build_object('shogi_id', p_game_id, 'reason', 'resignation')
  );
  perform public._resolve_skill_spectator_market('shogi', p_game_id, v_winner);
  update public.shogi_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null,
      result_reason = 'resignation', settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.accept_shogi_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if v_game.draw_offered_by is null then raise exception 'no draw offer pending'; end if;
  if v_game.draw_offered_by = v_user_id then raise exception 'cannot accept your own draw offer'; end if;
  perform public._settle_skill_duel(
    public._shogi_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'shogi', true, 'shogi_settle', 'shogi:' || p_game_id::text,
    jsonb_build_object('shogi_id', p_game_id, 'reason', 'agreed_draw')
  );
  perform public._resolve_skill_spectator_market('shogi', p_game_id, null);
  update public.shogi_games
  set status = 'draw', winner_id = null, current_turn_id = null,
      result_reason = 'agreed_draw', settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Chess + Connect Four — resolve spectator on resign / agreed draw
-- ---------------------------------------------------------------------------
create or replace function public.resign_chess_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(
    public._chess_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id, 'reason', 'resignation')
  );
  perform public._resolve_skill_spectator_market('chess', p_game_id, v_winner);
  update public.chess_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null,
      result_reason = 'resignation', settled_at = now(),
      clock_running_since = null
  where id = p_game_id;
end; $$;

create or replace function public.accept_chess_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.draw_offered_by is null or v_game.draw_offered_by = v_user_id then raise exception 'no valid draw offer'; end if;
  perform public._settle_skill_duel(
    public._chess_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'chess', true, 'chess_settle', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id, 'reason', 'agreed_draw')
  );
  perform public._resolve_skill_spectator_market('chess', p_game_id, null);
  update public.chess_games
  set status = 'draw', winner_id = null, current_turn_id = null,
      result_reason = 'agreed_draw', settled_at = now(), draw_offered_by = null,
      clock_running_since = null
  where id = p_game_id;
end; $$;

create or replace function public.resign_connect4_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'can only resign after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(
    public._connect4_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'connect4', false, 'connect4_settle', 'connect4:' || p_game_id::text,
    jsonb_build_object('connect4_id', p_game_id, 'reason', 'resignation')
  );
  perform public._resolve_skill_spectator_market('connect4', p_game_id, v_winner);
  update public.connect4_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.accept_connect4_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if v_game.draw_offered_by is null then raise exception 'no draw offer pending'; end if;
  if v_game.draw_offered_by = v_user_id then raise exception 'cannot accept your own draw offer'; end if;
  perform public._settle_skill_duel(
    public._connect4_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'connect4', true, 'connect4_settle', 'connect4:' || p_game_id::text,
    jsonb_build_object('connect4_id', p_game_id, 'reason', 'agreed_draw')
  );
  perform public._resolve_skill_spectator_market('connect4', p_game_id, null);
  update public.connect4_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

-- ---------------------------------------------------------------------------
-- get_*_game — return spectator_market_id (fixes UI panel)
-- ---------------------------------------------------------------------------
drop function if exists public.get_chess_game(uuid);

create or replace function public.get_chess_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, fen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  spectator_market_id uuid,
  clock_initial_sec int, clock_increment_sec int,
  white_ms_left int, black_ms_left int, clock_running_since timestamptz
)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly,
    g.fen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id,
    g.move_count, g.draw_offered_by, g.started_at,
    g.spectator_market_id,
    g.clock_initial_sec, g.clock_increment_sec,
    g.white_ms_left, g.black_ms_left, g.clock_running_since
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

drop function if exists public.get_connect4_game(uuid);

create or replace function public.get_connect4_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  invited_user_id uuid, stake bigint, is_friendly boolean, board int[], current_turn_id uuid,
  status text, winner_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  spectator_market_id uuid
) language sql stable security definer set search_path = '' as $$
  select g.id, g.creator_id, coalesce(pc.display_name, 'Player'), g.opponent_id,
    coalesce(po.display_name, 'Player'), g.invited_user_id, g.stake, g.is_friendly, g.board,
    g.current_turn_id, g.status, g.winner_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at,
    g.spectator_market_id
  from public.connect4_games g
  left join public.profiles pc on pc.id = g.creator_id
  left join public.profiles po on po.id = g.opponent_id
  where g.id = p_game_id;
$$;

drop function if exists public.get_checkers_game(uuid);

create or replace function public.get_checkers_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, board int[], current_turn_id uuid, status text,
  winner_id uuid, invited_user_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  spectator_market_id uuid
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.board, g.current_turn_id,
    g.status, g.winner_id, g.invited_user_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at,
    g.spectator_market_id
  from public.checkers_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

drop function if exists public.get_go_game(uuid);

create or replace function public.get_go_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, board int[], prev_board int[], pass_count int,
  current_turn_id uuid, status text, winner_id uuid, black_score numeric, white_score numeric,
  invited_user_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  spectator_market_id uuid
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.board, g.prev_board,
    g.pass_count, g.current_turn_id, g.status, g.winner_id, g.black_score, g.white_score,
    g.invited_user_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at,
    g.spectator_market_id
  from public.go_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

drop function if exists public.get_shogi_game(uuid);

create or replace function public.get_shogi_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, sfen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  spectator_market_id uuid
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.sfen, g.current_turn_id,
    g.status, g.winner_id, g.result_reason, g.invited_user_id,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at,
    g.spectator_market_id
  from public.shogi_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

grant execute on function public.get_chess_game(uuid) to authenticated;
grant execute on function public.get_connect4_game(uuid) to authenticated;
grant execute on function public.get_checkers_game(uuid) to authenticated;
grant execute on function public.get_go_game(uuid) to authenticated;
grant execute on function public.get_shogi_game(uuid) to authenticated;
