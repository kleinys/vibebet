-- Fix get_poker_game returning no row (404 on bot matches) when profile join fails.

create or replace function public.get_poker_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, state jsonb, status text, winner_id uuid,
  creator_hand_rank text, opponent_hand_rank text, invited_user_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    g.creator_id,
    coalesce(cp.display_name, 'Player'),
    g.opponent_id,
    coalesce(
      op.display_name,
      case when g.opponent_id = public._platform_bot_id() then 'House Bot' else '…' end
    ),
    g.stake,
    g.is_friendly,
    case
      when g.state is null then null
      when g.status <> 'active' then g.state
      when (g.state->>'phase') = 'showdown' then g.state
      when auth.uid() = g.creator_id then
        jsonb_set(g.state, '{hole,opponent}', '["??","??"]'::jsonb)
      when auth.uid() = g.opponent_id then
        jsonb_set(g.state, '{hole,creator}', '["??","??"]'::jsonb)
      else
        jsonb_set(
          jsonb_set(g.state, '{hole,creator}', '["??","??"]'::jsonb),
          '{hole,opponent}',
          '["??","??"]'::jsonb
        )
    end,
    g.status,
    g.winner_id,
    g.creator_hand_rank,
    g.opponent_hand_rank,
    g.invited_user_id
  from public.poker_games g
  left join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

revoke all on function public.get_poker_game(uuid) from public;
grant execute on function public.get_poker_game(uuid) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('poker_enabled', true, 'Heads-up hold''em showdown at /games/duels/poker')
on conflict (key) do update set enabled = true;
