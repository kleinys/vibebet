-- Phase 35: Chess lifecycle — matched phase, leave before lock, mutual draw

alter table public.chess_games
  add column if not exists move_count int not null default 0,
  add column if not exists draw_offered_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz;

alter table public.chess_games drop constraint if exists chess_games_status_check;
alter table public.chess_games add constraint chess_games_status_check
  check (status in ('open', 'matched', 'active', 'settled', 'cancelled', 'draw'));

drop policy if exists chess_games_select on public.chess_games;
create policy chess_games_select on public.chess_games for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
    or status in ('matched', 'active', 'settled', 'draw')
  );

create or replace function public._abort_skill_duel(
  p_escrow_code text,
  p_creator_id  uuid,
  p_opponent_id uuid,
  p_stake       bigint,
  p_tx_kind     text,
  p_tx_ref      text,
  p_metadata    jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_escrow uuid;
  v_tx_id  uuid;
  v_pool   bigint;
begin
  if p_stake <= 0 then return; end if;
  v_pool := p_stake * 2;
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_tx_kind || '_abort', p_tx_ref || ':abort', p_metadata, p_creator_id)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, public._wallet_for_user(p_creator_id), p_stake, 'vibe'),
    (v_tx_id, public._wallet_for_user(p_opponent_id), p_stake, 'vibe');
end;
$$;

create or replace function public.accept_chess_game(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
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
      draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.apply_chess_state(
  p_game_id uuid, p_fen text, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_result text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype; v_new_count int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status not in ('matched', 'active') then raise exception 'game not in play'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  v_new_count := v_game.move_count + 1;

  if p_status = 'active' then
    update public.chess_games
    set fen = p_fen,
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
      public._chess_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
      v_game.stake, v_game.is_friendly, 'chess', true, 'chess_settle', 'chess:' || p_game_id::text,
      jsonb_build_object('chess_id', p_game_id)
    );
    update public.chess_games
    set fen = p_fen, status = 'draw', winner_id = null, current_turn_id = null,
        result_reason = p_result, settled_at = now(), draw_offered_by = null
    where id = p_game_id;
    return;
  end if;

  perform public._settle_skill_duel(
    public._chess_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id)
  );
  update public.chess_games
  set fen = p_fen, status = 'settled', winner_id = p_winner_id, current_turn_id = null,
      result_reason = p_result, settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.leave_chess_game(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'matched' then raise exception 'game already started — use resign instead'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  perform public._abort_skill_duel(
    public._chess_escrow_code(p_game_id), v_game.creator_id, v_game.opponent_id,
    v_game.stake, 'chess', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id, 'reason', 'leave_before_start')
  );
  update public.chess_games set status = 'cancelled', current_turn_id = null where id = p_game_id;
end; $$;

create or replace function public.offer_chess_draw(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'draw only after both players have moved'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.chess_games set draw_offered_by = v_user_id where id = p_game_id;
end; $$;

create or replace function public.accept_chess_draw(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if v_game.draw_offered_by is null then raise exception 'no draw offer pending'; end if;
  if v_game.draw_offered_by = v_user_id then raise exception 'cannot accept your own draw offer'; end if;
  perform public._settle_skill_duel(
    public._chess_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id,
    v_game.stake, v_game.is_friendly, 'chess', true, 'chess_settle', 'chess:' || p_game_id::text,
    jsonb_build_object('chess_id', p_game_id, 'reason', 'agreed_draw')
  );
  update public.chess_games
  set status = 'draw', winner_id = null, current_turn_id = null,
      result_reason = 'agreed_draw', settled_at = now(), draw_offered_by = null
  where id = p_game_id;
end; $$;

create or replace function public.decline_chess_draw(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.chess_games set draw_offered_by = null where id = p_game_id;
end; $$;

create or replace function public.get_chess_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, fen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly,
    g.fen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id,
    g.move_count, g.draw_offered_by, g.started_at
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

create or replace function public.get_live_chess_games(p_limit int default 12)
returns table (
  id uuid, creator_name text, opponent_name text, is_friendly boolean, stake bigint,
  move_count int, status text, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id,
    coalesce(cp.display_name, 'Player') as creator_name,
    coalesce(op.display_name, '…') as opponent_name,
    g.is_friendly, g.stake, g.move_count, g.status, g.started_at
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

revoke execute on function public._abort_skill_duel(text, uuid, uuid, bigint, text, text, jsonb) from public;
revoke execute on function public.leave_chess_game(uuid) from public;
revoke execute on function public.offer_chess_draw(uuid) from public;
revoke execute on function public.accept_chess_draw(uuid) from public;
revoke execute on function public.decline_chess_draw(uuid) from public;
revoke execute on function public.get_live_chess_games(int) from public;

grant execute on function public.leave_chess_game(uuid) to authenticated;
grant execute on function public.offer_chess_draw(uuid) to authenticated;
grant execute on function public.accept_chess_draw(uuid) to authenticated;
grant execute on function public.decline_chess_draw(uuid) to authenticated;
grant execute on function public.get_live_chess_games(int) to authenticated;
