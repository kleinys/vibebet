-- Safe to re-run if phase 35 failed on get_chess_game return type change.
-- Run this in Supabase SQL Editor if you saw: "cannot change return type of existing function"

drop function if exists public.get_chess_game(uuid);
drop function if exists public.get_live_chess_games(int);

create or replace function public.get_chess_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, fen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid,
  move_count int, draw_offered_by uuid, started_at timestamptz
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly,
    g.fen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id,
    coalesce(g.move_count, 0), g.draw_offered_by, g.started_at
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
    g.is_friendly, g.stake, coalesce(g.move_count, 0), g.status, g.started_at
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.status in ('matched', 'active')
  order by coalesce(g.started_at, g.created_at) desc
  limit p_limit;
$$;

revoke execute on function public.get_live_chess_games(int) from public;
grant execute on function public.get_live_chess_games(int) to authenticated;
