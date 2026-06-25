-- Phase 36: Connect Four lifecycle — matched phase, leave, resign, mutual draw, spectate

alter table public.connect4_games
  add column if not exists move_count int not null default 0,
  add column if not exists draw_offered_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz;

alter table public.connect4_games drop constraint if exists connect4_games_status_check;
alter table public.connect4_games add constraint connect4_games_status_check
  check (status in ('open', 'matched', 'active', 'settled', 'cancelled', 'draw'));

drop policy if exists connect4_games_select on public.connect4_games;
create policy connect4_games_select on public.connect4_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
    or status in ('matched', 'active', 'settled', 'draw')
  );

create or replace function public.accept_connect4_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'this game is reserved for another player';
  end if;
  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'connect4_accept', 'connect4_accept:' || p_game_id::text,
      public._connect4_escrow_code(p_game_id), jsonb_build_object('connect4_id', p_game_id)
    );
  end if;
  update public.connect4_games
  set opponent_id = v_user_id, status = 'matched', current_turn_id = creator_id,
      move_count = 0, draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.leave_connect4_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'matched' then raise exception 'game already started — use resign instead'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  perform public._abort_skill_duel(
    public._connect4_escrow_code(p_game_id), v_game.creator_id, v_game.opponent_id,
    v_game.stake, 'connect4', 'connect4:' || p_game_id::text,
    jsonb_build_object('connect4_id', p_game_id, 'reason', 'leave_before_start')
  );
  update public.connect4_games set status = 'cancelled', current_turn_id = null where id = p_game_id;
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
  update public.connect4_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.offer_connect4_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'draw only after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.connect4_games set draw_offered_by = v_user_id where id = p_game_id;
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
  update public.connect4_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.decline_connect4_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.connect4_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.connect4_games set draw_offered_by = null where id = p_game_id;
end; $$;

create or replace function public.play_connect4_move(p_game_id uuid, p_col int)
returns table (winner_id uuid, is_draw boolean, row_played int)
language plpgsql security definer set search_path = '' as $$
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

  return query select null::uuid, false, v_row;
end; $$;

drop function if exists public.get_connect4_game(uuid);

create or replace function public.get_connect4_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  invited_user_id uuid, stake bigint, is_friendly boolean, board int[], current_turn_id uuid,
  status text, winner_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select g.id, g.creator_id, coalesce(pc.display_name, 'Player'), g.opponent_id,
    coalesce(po.display_name, 'Player'), g.invited_user_id, g.stake, g.is_friendly, g.board,
    g.current_turn_id, g.status, g.winner_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at
  from public.connect4_games g
  left join public.profiles pc on pc.id = g.creator_id
  left join public.profiles po on po.id = g.opponent_id
  where g.id = p_game_id;
$$;

create or replace function public.get_live_connect4_games(p_limit int default 12)
returns table (
  id uuid, creator_name text, opponent_name text, is_friendly boolean, stake bigint,
  move_count int, status text, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, coalesce(cp.display_name, 'Player'), coalesce(op.display_name, '…'),
    g.is_friendly, g.stake, coalesce(g.move_count, 0), g.status, g.started_at
  from public.connect4_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

revoke execute on function public.leave_connect4_game(uuid) from public;
revoke execute on function public.resign_connect4_game(uuid) from public;
revoke execute on function public.offer_connect4_draw(uuid) from public;
revoke execute on function public.accept_connect4_draw(uuid) from public;
revoke execute on function public.decline_connect4_draw(uuid) from public;
revoke execute on function public.get_live_connect4_games(int) from public;

grant execute on function public.leave_connect4_game(uuid) to authenticated;
grant execute on function public.resign_connect4_game(uuid) to authenticated;
grant execute on function public.offer_connect4_draw(uuid) to authenticated;
grant execute on function public.accept_connect4_draw(uuid) to authenticated;
grant execute on function public.decline_connect4_draw(uuid) to authenticated;
grant execute on function public.get_live_connect4_games(int) to authenticated;
