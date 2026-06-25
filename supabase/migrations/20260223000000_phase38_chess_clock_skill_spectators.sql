-- Phase 38: Chess clock (5+3 blitz optional) + skill-game spectator betting

-- ---------------------------------------------------------------------------
-- A) Schema — chess clock
-- ---------------------------------------------------------------------------
alter table public.chess_games
  add column if not exists clock_initial_sec int,
  add column if not exists clock_increment_sec int not null default 3,
  add column if not exists white_ms_left int,
  add column if not exists black_ms_left int,
  add column if not exists clock_running_since timestamptz;

-- ---------------------------------------------------------------------------
-- B) Schema — spectator markets on skill games
-- ---------------------------------------------------------------------------
alter table public.chess_games
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

alter table public.connect4_games
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

alter table public.checkers_games
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

alter table public.go_games
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

alter table public.shogi_games
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Skill spectator market helpers (pattern: phase 21 duel spectator)
-- ---------------------------------------------------------------------------
create or replace function public._create_skill_spectator_market(
  p_game_type text,
  p_game_id   uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled      boolean := false;
  v_creator_id   uuid;
  v_opponent_id  uuid;
  v_market_id    uuid;
  v_creator_name text;
  v_opponent_name text;
  v_game_label   text;
  v_question     text;
  v_spectator_id uuid;
begin
  select coalesce(
    (select enabled from public.feature_flags where key = 'skill_game_spectators_enabled'),
    false
  ) into v_enabled;
  if not v_enabled then return null; end if;

  case p_game_type
    when 'chess' then
      v_game_label := 'Chess';
      select creator_id, opponent_id, spectator_market_id
        into v_creator_id, v_opponent_id, v_market_id
        from public.chess_games where id = p_game_id;
    when 'connect4' then
      v_game_label := 'Connect Four';
      select creator_id, opponent_id, spectator_market_id
        into v_creator_id, v_opponent_id, v_market_id
        from public.connect4_games where id = p_game_id;
    when 'checkers' then
      v_game_label := 'Checkers';
      select creator_id, opponent_id, spectator_market_id
        into v_creator_id, v_opponent_id, v_market_id
        from public.checkers_games where id = p_game_id;
    when 'go' then
      v_game_label := 'Go';
      select creator_id, opponent_id, spectator_market_id
        into v_creator_id, v_opponent_id, v_market_id
        from public.go_games where id = p_game_id;
    when 'shogi' then
      v_game_label := 'Shogi';
      select creator_id, opponent_id, spectator_market_id
        into v_creator_id, v_opponent_id, v_market_id
        from public.shogi_games where id = p_game_id;
    else
      raise exception 'unknown game type: %', p_game_type;
  end case;

  if v_creator_id is null then raise exception 'game not found'; end if;
  if v_opponent_id is null then raise exception 'game has no opponent'; end if;
  if v_market_id is not null then return v_market_id; end if;

  select coalesce(display_name, 'Player') into v_creator_name
    from public.profiles where id = v_creator_id;
  select coalesce(display_name, 'Player') into v_opponent_name
    from public.profiles where id = v_opponent_id;

  v_question := format(
    'Will %s beat %s in %s?',
    left(v_creator_name, 40),
    left(v_opponent_name, 40),
    v_game_label
  );

  v_spectator_id := public._create_platform_market(
    v_creator_id,
    left(v_question, 280),
    format(
      'Spectator market for %s game %s. Resolves YES if %s wins. Settles when the game ends.',
      v_game_label,
      p_game_id,
      v_creator_name
    ),
    2500,
    0.5,
    now() + interval '7 days',
    'other'::public.market_category,
    left(v_creator_name, 32),
    left(v_opponent_name, 32),
    'platform'::public.market_source,
    false,
    null, null, null, null, null
  );

  case p_game_type
    when 'chess' then
      update public.chess_games set spectator_market_id = v_spectator_id where id = p_game_id;
    when 'connect4' then
      update public.connect4_games set spectator_market_id = v_spectator_id where id = p_game_id;
    when 'checkers' then
      update public.checkers_games set spectator_market_id = v_spectator_id where id = p_game_id;
    when 'go' then
      update public.go_games set spectator_market_id = v_spectator_id where id = p_game_id;
    when 'shogi' then
      update public.shogi_games set spectator_market_id = v_spectator_id where id = p_game_id;
  end case;

  return v_spectator_id;
end;
$$;

create or replace function public._resolve_skill_spectator_market(
  p_game_type text,
  p_game_id   uuid,
  p_winner_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id   uuid;
  v_creator_id  uuid;
  v_status      public.market_status;
begin
  case p_game_type
    when 'chess' then
      select spectator_market_id, creator_id into v_market_id, v_creator_id
        from public.chess_games where id = p_game_id;
    when 'connect4' then
      select spectator_market_id, creator_id into v_market_id, v_creator_id
        from public.connect4_games where id = p_game_id;
    when 'checkers' then
      select spectator_market_id, creator_id into v_market_id, v_creator_id
        from public.checkers_games where id = p_game_id;
    when 'go' then
      select spectator_market_id, creator_id into v_market_id, v_creator_id
        from public.go_games where id = p_game_id;
    when 'shogi' then
      select spectator_market_id, creator_id into v_market_id, v_creator_id
        from public.shogi_games where id = p_game_id;
    else
      raise exception 'unknown game type: %', p_game_type;
  end case;

  if v_market_id is null then return; end if;

  select status into v_status from public.markets where id = v_market_id;
  if v_status is distinct from 'open' then return; end if;

  begin
    if p_winner_id is null then
      perform public._void_mirror_market_internal(v_market_id);
    else
      perform public.finalize_market_internal(v_market_id, p_winner_id = v_creator_id);
    end if;
  exception when others then null;
  end;
end;
$$;

revoke execute on function public._create_skill_spectator_market(text, uuid) from public;
revoke execute on function public._resolve_skill_spectator_market(text, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Chess RPCs — clock + spectator hooks
-- ---------------------------------------------------------------------------
drop function if exists public.create_chess_game(bigint, text, boolean);

create or replace function public.create_chess_game(
  p_stake              bigint,
  p_invite_code        text default null,
  p_friendly           boolean default false,
  p_clock_initial_sec  int default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_invited    uuid;
  v_id         uuid;
  v_stake      bigint;
  v_friendly   boolean := coalesce(p_friendly, false);
  v_clock_on   boolean := false;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  if p_clock_initial_sec is not null then
    if p_clock_initial_sec <= 0 then raise exception 'clock initial seconds must be positive'; end if;
    select coalesce(
      (select enabled from public.feature_flags where key = 'chess_clock_enabled'),
      false
    ) into v_clock_on;
    if not v_clock_on then raise exception 'chess clock is disabled'; end if;
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.chess_games (
    creator_id, stake, invited_user_id, is_friendly, clock_initial_sec
  ) values (
    v_user_id, v_stake, v_invited, v_friendly, p_clock_initial_sec
  ) returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'chess_create', 'chess:' || v_id::text,
      public._chess_escrow_code(v_id), jsonb_build_object('chess_id', v_id)
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.accept_chess_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'reserved for another player';
  end if;
  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'chess_accept', 'chess_accept:' || p_game_id::text,
      public._chess_escrow_code(p_game_id), jsonb_build_object('chess_id', p_game_id)
    );
  end if;
  update public.chess_games
  set opponent_id = v_user_id,
      status = 'matched',
      current_turn_id = creator_id,
      move_count = 0,
      draw_offered_by = null,
      white_ms_left = case when clock_initial_sec is not null then clock_initial_sec * 1000 else null end,
      black_ms_left = case when clock_initial_sec is not null then clock_initial_sec * 1000 else null end,
      clock_running_since = null
  where id = p_game_id;
end;
$$;

create or replace function public.apply_chess_state(
  p_game_id       uuid,
  p_fen           text,
  p_next_turn_id  uuid,
  p_status        text,
  p_winner_id     uuid,
  p_result        text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_game         public.chess_games%rowtype;
  v_new_count    int;
  v_new_status   text;
  v_white_ms     int;
  v_black_ms     int;
  v_elapsed_ms   int;
  v_timeout_win  uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_white_ms := v_game.white_ms_left;
  v_black_ms := v_game.black_ms_left;

  if v_game.clock_initial_sec is not null then
    if v_game.clock_running_since is not null then
      v_elapsed_ms := (extract(epoch from (now() - v_game.clock_running_since)) * 1000)::int;
      if v_user_id = v_game.creator_id then
        v_white_ms := coalesce(v_white_ms, v_game.clock_initial_sec * 1000) - v_elapsed_ms;
        if v_white_ms <= 0 then
          v_timeout_win := v_game.opponent_id;
          perform public._settle_skill_duel(
            public._chess_escrow_code(p_game_id), v_timeout_win, v_game.creator_id, v_game.opponent_id,
            v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
            jsonb_build_object('chess_id', p_game_id, 'reason', 'timeout')
          );
          perform public._resolve_skill_spectator_market('chess', p_game_id, v_timeout_win);
          update public.chess_games
          set fen = p_fen,
              status = 'settled',
              winner_id = v_timeout_win,
              current_turn_id = null,
              result_reason = 'timeout',
              settled_at = now(),
              draw_offered_by = null,
              white_ms_left = 0,
              black_ms_left = v_black_ms,
              clock_running_since = null
          where id = p_game_id;
          return;
        end if;
      else
        v_black_ms := coalesce(v_black_ms, v_game.clock_initial_sec * 1000) - v_elapsed_ms;
        if v_black_ms <= 0 then
          v_timeout_win := v_game.creator_id;
          perform public._settle_skill_duel(
            public._chess_escrow_code(p_game_id), v_timeout_win, v_game.creator_id, v_game.opponent_id,
            v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
            jsonb_build_object('chess_id', p_game_id, 'reason', 'timeout')
          );
          perform public._resolve_skill_spectator_market('chess', p_game_id, v_timeout_win);
          update public.chess_games
          set fen = p_fen,
              status = 'settled',
              winner_id = v_timeout_win,
              current_turn_id = null,
              result_reason = 'timeout',
              settled_at = now(),
              draw_offered_by = null,
              white_ms_left = v_white_ms,
              black_ms_left = 0,
              clock_running_since = null
          where id = p_game_id;
          return;
        end if;
      end if;
    end if;

    if v_user_id = v_game.creator_id then
      v_white_ms := coalesce(v_white_ms, v_game.clock_initial_sec * 1000)
                    + v_game.clock_increment_sec * 1000;
    else
      v_black_ms := coalesce(v_black_ms, v_game.clock_initial_sec * 1000)
                    + v_game.clock_increment_sec * 1000;
    end if;
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
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end,
        white_ms_left = v_white_ms,
        black_ms_left = v_black_ms,
        clock_running_since = case when v_game.clock_initial_sec is not null then now() else null end
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
      jsonb_build_object('chess_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('chess', p_game_id, null);
    update public.chess_games
    set fen = p_fen,
        status = 'draw',
        winner_id = null,
        current_turn_id = null,
        result_reason = p_result,
        settled_at = now(),
        draw_offered_by = null,
        white_ms_left = v_white_ms,
        black_ms_left = v_black_ms,
        clock_running_since = null
    where id = p_game_id;
    return;
  end if;

  perform public._settle_skill_duel(
    public._chess_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id)
  );
  perform public._resolve_skill_spectator_market('chess', p_game_id, p_winner_id);
  update public.chess_games
  set fen = p_fen,
      status = 'settled',
      winner_id = p_winner_id,
      current_turn_id = null,
      result_reason = p_result,
      settled_at = now(),
      draw_offered_by = null,
      white_ms_left = v_white_ms,
      black_ms_left = v_black_ms,
      clock_running_since = null
  where id = p_game_id;
end;
$$;

drop function if exists public.get_chess_game(uuid);

create or replace function public.get_chess_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, fen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid,
  move_count int, draw_offered_by uuid, started_at timestamptz,
  clock_initial_sec int, clock_increment_sec int,
  white_ms_left int, black_ms_left int, clock_running_since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly,
    g.fen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id,
    g.move_count, g.draw_offered_by, g.started_at,
    g.clock_initial_sec, g.clock_increment_sec,
    g.white_ms_left, g.black_ms_left, g.clock_running_since
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

-- ---------------------------------------------------------------------------
-- Connect Four — spectator hooks in play_connect4_move
-- ---------------------------------------------------------------------------
create or replace function public.play_connect4_move(p_game_id uuid, p_col int)
returns table (winner_id uuid, is_draw boolean, row_played int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.connect4_games%rowtype;
  v_row int; v_ok boolean; v_piece int; v_winner uuid;
  v_new_count int; v_new_status text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_col < 0 or p_col > 6 then raise exception 'column must be 0–6'; end if;

  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  select r.row_idx, r.ok into v_row, v_ok from public._connect4_col_row(v_game.board, p_col) r;
  if not v_ok then raise exception 'column full'; end if;

  v_piece := case when v_user_id = v_game.creator_id then 1 else 2 end;
  v_game.board[v_row * 7 + p_col + 1] := v_piece;
  v_new_count := v_game.move_count + 1;
  v_new_status := case when v_new_count >= 2 then 'active' else 'matched' end;

  if public._connect4_check_win(v_game.board, v_piece) then
    v_winner := v_user_id;
    perform public._settle_skill_duel(
      public._connect4_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'connect4', false, 'connect4_settle', 'connect4:' || p_game_id::text,
      jsonb_build_object('connect4_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('connect4', p_game_id, v_winner);
    update public.connect4_games
    set board = v_game.board, status = 'settled', winner_id = v_winner, current_turn_id = null,
        move_count = v_new_count, started_at = coalesce(started_at, now()), settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return query select v_winner, false, v_row;
    return;
  end if;

  if public._connect4_board_full(v_game.board) then
    perform public._settle_skill_duel(
      public._connect4_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'connect4', true, 'connect4_settle', 'connect4:' || p_game_id::text,
      jsonb_build_object('connect4_id', p_game_id)
    );
    perform public._resolve_skill_spectator_market('connect4', p_game_id, null);
    update public.connect4_games
    set board = v_game.board, status = 'draw', winner_id = null, current_turn_id = null,
        move_count = v_new_count, started_at = coalesce(started_at, now()), settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return query select null::uuid, true, v_row;
    return;
  end if;

  update public.connect4_games set
    board = v_game.board,
    move_count = v_new_count,
    status = v_new_status,
    started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end,
    draw_offered_by = null,
    current_turn_id = case when v_user_id = creator_id then opponent_id else creator_id end
  where id = p_game_id;

  if v_new_status = 'active' and v_game.move_count < 2 then
    perform public._create_skill_spectator_market('connect4', p_game_id);
  end if;

  return query select null::uuid, false, v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.create_chess_game(bigint, text, boolean, int) from public;
grant execute on function public.create_chess_game(bigint, text, boolean, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, description)
values
  ('skill_game_spectators_enabled', false, 'Spawn spectator CPMM markets when skill games become active'),
  ('chess_clock_enabled', false, 'Allow optional Fischer clock (e.g. 5+3 blitz) on chess games')
on conflict (key) do update
  set description = excluded.description;
