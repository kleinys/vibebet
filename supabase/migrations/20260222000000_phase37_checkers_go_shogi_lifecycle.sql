-- Phase 37: Checkers, Go, Shogi lifecycle — matched phase, leave, resign, mutual draw, spectate

-- —— Checkers schema ——
alter table public.checkers_games
  add column if not exists move_count int not null default 0,
  add column if not exists draw_offered_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz;

alter table public.checkers_games drop constraint if exists checkers_games_status_check;
alter table public.checkers_games add constraint checkers_games_status_check
  check (status in ('open', 'matched', 'active', 'settled', 'cancelled', 'draw'));

drop policy if exists checkers_games_select on public.checkers_games;
create policy checkers_games_select on public.checkers_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
    or status in ('matched', 'active', 'settled', 'draw')
  );

-- —— Go schema ——
alter table public.go_games
  add column if not exists move_count int not null default 0,
  add column if not exists draw_offered_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz;

alter table public.go_games drop constraint if exists go_games_status_check;
alter table public.go_games add constraint go_games_status_check
  check (status in ('open', 'matched', 'active', 'settled', 'cancelled', 'draw'));

drop policy if exists go_games_select on public.go_games;
create policy go_games_select on public.go_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
    or status in ('matched', 'active', 'settled', 'draw')
  );

-- —— Shogi schema ——
alter table public.shogi_games
  add column if not exists move_count int not null default 0,
  add column if not exists draw_offered_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz;

alter table public.shogi_games drop constraint if exists shogi_games_status_check;
alter table public.shogi_games add constraint shogi_games_status_check
  check (status in ('open', 'matched', 'active', 'settled', 'cancelled', 'draw'));

drop policy if exists shogi_games_select on public.shogi_games;
create policy shogi_games_select on public.shogi_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
    or status in ('matched', 'active', 'settled', 'draw')
  );

-- =============================================================================
-- Checkers RPCs
-- =============================================================================

create or replace function public.accept_checkers_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'this game is reserved for another player';
  end if;
  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'checkers_accept', 'checkers_accept:' || p_game_id::text,
      public._checkers_escrow_code(p_game_id), jsonb_build_object('checkers_id', p_game_id)
    );
  end if;
  update public.checkers_games
  set opponent_id = v_user_id, status = 'matched', current_turn_id = creator_id,
      move_count = 0, draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.leave_checkers_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'matched' then raise exception 'game already started — use resign instead'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  perform public._abort_skill_duel(
    public._checkers_escrow_code(p_game_id), v_game.creator_id, v_game.opponent_id,
    v_game.stake, 'checkers', 'checkers:' || p_game_id::text,
    jsonb_build_object('checkers_id', p_game_id, 'reason', 'leave_before_start')
  );
  update public.checkers_games set status = 'cancelled', current_turn_id = null where id = p_game_id;
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
  update public.checkers_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.offer_checkers_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'draw only after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.checkers_games set draw_offered_by = v_user_id where id = p_game_id;
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
  update public.checkers_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.decline_checkers_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.checkers_games set draw_offered_by = null where id = p_game_id;
end; $$;

create or replace function public.apply_checkers_state(
  p_game_id uuid, p_board int[], p_next_turn_id uuid, p_status text, p_winner_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype; v_new_count int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;

  if p_status = 'active' then
    update public.checkers_games
    set board = p_board,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = case when v_new_count >= 2 then 'active' else 'matched' end,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._checkers_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'checkers', true, 'checkers_settle', 'checkers:' || p_game_id::text,
      jsonb_build_object('checkers_id', p_game_id)
    );
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
  update public.checkers_games
  set board = p_board, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
      settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

drop function if exists public.get_checkers_game(uuid);

create or replace function public.get_checkers_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, board int[], current_turn_id uuid, status text,
  winner_id uuid, invited_user_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.board, g.current_turn_id,
    g.status, g.winner_id, g.invited_user_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at
  from public.checkers_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

create or replace function public.get_live_checkers_games(p_limit int default 12)
returns table (
  id uuid, creator_name text, opponent_name text, is_friendly boolean, stake bigint,
  move_count int, status text, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, coalesce(cp.display_name, 'Player'), coalesce(op.display_name, '…'),
    g.is_friendly, g.stake, coalesce(g.move_count, 0), g.status, g.started_at
  from public.checkers_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

-- =============================================================================
-- Go RPCs
-- =============================================================================

create or replace function public.accept_go_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'this game is reserved for another player';
  end if;
  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'go_accept', 'go_accept:' || p_game_id::text,
      public._go_escrow_code(p_game_id), jsonb_build_object('go_id', p_game_id)
    );
  end if;
  update public.go_games
  set opponent_id = v_user_id, status = 'matched', current_turn_id = creator_id,
      move_count = 0, draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.leave_go_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'matched' then raise exception 'game already started — use resign instead'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  perform public._abort_skill_duel(
    public._go_escrow_code(p_game_id), v_game.creator_id, v_game.opponent_id,
    v_game.stake, 'go', 'go:' || p_game_id::text,
    jsonb_build_object('go_id', p_game_id, 'reason', 'leave_before_start')
  );
  update public.go_games set status = 'cancelled', current_turn_id = null where id = p_game_id;
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
  update public.go_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.offer_go_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'draw only after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.go_games set draw_offered_by = v_user_id where id = p_game_id;
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
  update public.go_games
  set status = 'draw', winner_id = null, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.decline_go_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.go_games set draw_offered_by = null where id = p_game_id;
end; $$;

create or replace function public.apply_go_state(
  p_game_id uuid, p_board int[], p_prev_board int[], p_pass_count int,
  p_next_turn_id uuid, p_status text, p_winner_id uuid,
  p_black_score numeric default null, p_white_score numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype; v_new_count int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;

  if p_status = 'active' then
    update public.go_games
    set board = p_board,
        prev_board = p_prev_board,
        pass_count = p_pass_count,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = case when v_new_count >= 2 then 'active' else 'matched' end,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._go_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'go', true, 'go_settle', 'go:' || p_game_id::text,
      jsonb_build_object('go_id', p_game_id)
    );
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
  update public.go_games
  set board = p_board, status = 'settled', winner_id = p_winner_id, black_score = p_black_score,
      white_score = p_white_score, current_turn_id = null, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

drop function if exists public.get_go_game(uuid);

create or replace function public.get_go_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, board int[], prev_board int[], pass_count int,
  current_turn_id uuid, status text, winner_id uuid, black_score numeric, white_score numeric,
  invited_user_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.board, g.prev_board,
    g.pass_count, g.current_turn_id, g.status, g.winner_id, g.black_score, g.white_score,
    g.invited_user_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at
  from public.go_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

create or replace function public.get_live_go_games(p_limit int default 12)
returns table (
  id uuid, creator_name text, opponent_name text, is_friendly boolean, stake bigint,
  move_count int, status text, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, coalesce(cp.display_name, 'Player'), coalesce(op.display_name, '…'),
    g.is_friendly, g.stake, coalesce(g.move_count, 0), g.status, g.started_at
  from public.go_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

-- =============================================================================
-- Shogi RPCs
-- =============================================================================

create or replace function public.accept_shogi_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'this game is reserved for another player';
  end if;
  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'shogi_accept', 'shogi_accept:' || p_game_id::text,
      public._shogi_escrow_code(p_game_id), jsonb_build_object('shogi_id', p_game_id)
    );
  end if;
  update public.shogi_games
  set opponent_id = v_user_id, status = 'matched', current_turn_id = creator_id,
      move_count = 0, draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.leave_shogi_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'matched' then raise exception 'game already started — use resign instead'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  perform public._abort_skill_duel(
    public._shogi_escrow_code(p_game_id), v_game.creator_id, v_game.opponent_id,
    v_game.stake, 'shogi', 'shogi:' || p_game_id::text,
    jsonb_build_object('shogi_id', p_game_id, 'reason', 'leave_before_start')
  );
  update public.shogi_games set status = 'cancelled', current_turn_id = null where id = p_game_id;
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
  update public.shogi_games
  set status = 'settled', winner_id = v_winner, current_turn_id = null,
      result_reason = 'resignation', settled_at = now()
  where id = p_game_id;
end; $$;

create or replace function public.offer_shogi_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'draw only after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.shogi_games set draw_offered_by = v_user_id where id = p_game_id;
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
  update public.shogi_games
  set status = 'draw', winner_id = null, current_turn_id = null,
      result_reason = 'agreed_draw', settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.decline_shogi_draw(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.shogi_games set draw_offered_by = null where id = p_game_id;
end; $$;

create or replace function public.apply_shogi_state(
  p_game_id uuid, p_sfen text, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_result text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype; v_new_count int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;

  if p_status = 'active' then
    update public.shogi_games
    set sfen = p_sfen,
        current_turn_id = p_next_turn_id,
        move_count = v_new_count,
        draw_offered_by = null,
        status = case when v_new_count >= 2 then 'active' else 'matched' end,
        started_at = case when v_new_count >= 2 and started_at is null then now() else started_at end
    where id = p_game_id;
    return;
  end if;

  if p_status = 'draw' then
    perform public._settle_skill_duel(
      public._shogi_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'shogi', true, 'shogi_settle', 'shogi:' || p_game_id::text,
      jsonb_build_object('shogi_id', p_game_id)
    );
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
  update public.shogi_games
  set sfen = p_sfen, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
      result_reason = p_result, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

drop function if exists public.get_shogi_game(uuid);

create or replace function public.get_shogi_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, sfen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid, settled_at timestamptz,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(cp.display_name, 'Player'), g.opponent_id,
    coalesce(op.display_name, 'Player'), g.stake, g.is_friendly, g.sfen, g.current_turn_id,
    g.status, g.winner_id, g.result_reason, g.invited_user_id, g.settled_at,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at
  from public.shogi_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

create or replace function public.get_live_shogi_games(p_limit int default 12)
returns table (
  id uuid, creator_name text, opponent_name text, is_friendly boolean, stake bigint,
  move_count int, status text, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, coalesce(cp.display_name, 'Player'), coalesce(op.display_name, '…'),
    g.is_friendly, g.stake, coalesce(g.move_count, 0), g.status, g.started_at
  from public.shogi_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

-- =============================================================================
-- Grants
-- =============================================================================

revoke execute on function public.leave_checkers_game(uuid) from public;
revoke execute on function public.resign_checkers_game(uuid) from public;
revoke execute on function public.offer_checkers_draw(uuid) from public;
revoke execute on function public.accept_checkers_draw(uuid) from public;
revoke execute on function public.decline_checkers_draw(uuid) from public;
revoke execute on function public.get_live_checkers_games(int) from public;

grant execute on function public.leave_checkers_game(uuid) to authenticated;
grant execute on function public.resign_checkers_game(uuid) to authenticated;
grant execute on function public.offer_checkers_draw(uuid) to authenticated;
grant execute on function public.accept_checkers_draw(uuid) to authenticated;
grant execute on function public.decline_checkers_draw(uuid) to authenticated;
grant execute on function public.get_live_checkers_games(int) to authenticated;

revoke execute on function public.leave_go_game(uuid) from public;
revoke execute on function public.offer_go_draw(uuid) from public;
revoke execute on function public.accept_go_draw(uuid) from public;
revoke execute on function public.decline_go_draw(uuid) from public;
revoke execute on function public.get_live_go_games(int) from public;

grant execute on function public.leave_go_game(uuid) to authenticated;
grant execute on function public.offer_go_draw(uuid) to authenticated;
grant execute on function public.accept_go_draw(uuid) to authenticated;
grant execute on function public.decline_go_draw(uuid) to authenticated;
grant execute on function public.get_live_go_games(int) to authenticated;

revoke execute on function public.leave_shogi_game(uuid) from public;
revoke execute on function public.offer_shogi_draw(uuid) from public;
revoke execute on function public.accept_shogi_draw(uuid) from public;
revoke execute on function public.decline_shogi_draw(uuid) from public;
revoke execute on function public.get_live_shogi_games(int) from public;

grant execute on function public.leave_shogi_game(uuid) to authenticated;
grant execute on function public.offer_shogi_draw(uuid) to authenticated;
grant execute on function public.accept_shogi_draw(uuid) to authenticated;
grant execute on function public.decline_shogi_draw(uuid) to authenticated;
grant execute on function public.get_live_shogi_games(int) to authenticated;
