-- Bot matches are friendly-only: zero stake, no escrow, no rating changes.

alter table public.dice_duels add column if not exists is_friendly boolean not null default false;

alter table public.dice_duels drop constraint if exists dice_duels_stake_check;
alter table public.dice_duels add constraint dice_duels_stake_check check (
  (is_friendly and stake = 0)
  or (not is_friendly and stake >= 10 and stake <= 10000)
);

-- ── Instant luck bots (friendly only) ───────────────────────────────────────

create or replace function public.play_rps_vs_bot(
  p_stake bigint,
  p_move  text
)
returns table (
  creator_move  text,
  opponent_move text,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_bot_id    uuid;
  v_bot_move  text;
  v_id        uuid;
  v_result    int;
  v_winner_id uuid;
  v_moves     text[] := array['rock', 'paper', 'scissors'];
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_move not in ('rock', 'paper', 'scissors') then raise exception 'pick rock, paper, or scissors'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  v_bot_move := v_moves[1 + floor(random() * 3)::int];
  v_result := public._rps_winner(p_move, v_bot_move);
  if v_result = 1 then v_winner_id := v_user_id;
  elsif v_result = -1 then v_winner_id := v_bot_id;
  else v_winner_id := null;
  end if;

  insert into public.rps_duels (
    creator_id, opponent_id, stake, creator_move, opponent_move, status, winner_id, settled_at, is_friendly
  ) values (
    v_user_id, v_bot_id, 0, p_move, v_bot_move, 'settled', v_winner_id, now(), true
  ) returning id into v_id;

  return query
  select p_move, v_bot_move, v_winner_id, 0::bigint, 'Platform Bot'::text;
end;
$$;

create or replace function public.play_high_card_vs_bot(p_stake bigint)
returns table (
  creator_card  int,
  opponent_card int,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_bot_id    uuid;
  v_id        uuid;
  v_c_card    int;
  v_o_card    int;
  v_winner_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  v_c_card := floor(random() * 13 + 1)::int;
  v_o_card := floor(random() * 13 + 1)::int;

  if v_c_card > v_o_card then v_winner_id := v_user_id;
  elsif v_o_card > v_c_card then v_winner_id := v_bot_id;
  else
    v_c_card := floor(random() * 13 + 1)::int;
    v_o_card := floor(random() * 13 + 1)::int;
    if v_c_card >= v_o_card then v_winner_id := v_user_id;
    else v_winner_id := v_bot_id;
    end if;
  end if;

  insert into public.high_card_duels (
    creator_id, opponent_id, stake, creator_card, opponent_card, status, winner_id, settled_at, is_friendly
  ) values (
    v_user_id, v_bot_id, 0, v_c_card, v_o_card, 'settled', v_winner_id, now(), true
  ) returning id into v_id;

  return query
  select v_c_card, v_o_card, v_winner_id, 0::bigint, 'Platform Bot'::text;
end;
$$;

create or replace function public.play_dice_vs_bot(p_stake bigint)
returns table (
  creator_roll  int,
  opponent_roll int,
  winner_id     uuid,
  payout        bigint,
  bot_name      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_bot_id    uuid;
  v_id        uuid;
  v_c_roll    int;
  v_o_roll    int;
  v_winner_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
  v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;

  if v_c_roll > v_o_roll then v_winner_id := v_user_id;
  elsif v_o_roll > v_c_roll then v_winner_id := v_bot_id;
  else
    v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    if v_c_roll >= v_o_roll then v_winner_id := v_user_id;
    else v_winner_id := v_bot_id;
    end if;
  end if;

  insert into public.dice_duels (
    creator_id, opponent_id, stake, creator_roll, opponent_roll, status, winner_id, settled_at, is_friendly
  ) values (
    v_user_id, v_bot_id, 0, v_c_roll, v_o_roll, 'settled', v_winner_id, now(), true
  ) returning id into v_id;

  return query
  select v_c_roll, v_o_roll, v_winner_id, 0::bigint, 'Platform Bot'::text;
end;
$$;

create or replace function public.play_liars_dice_vs_bot(p_stake bigint default 50)
returns table (winner_id uuid, payout bigint, bot_name text, you_won boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  v_winner := case when random() < 0.48 then v_user_id else v_bot_id end;

  insert into public.liars_dice_games (creator_id, opponent_id, stake, status, winner_id, settled_at, is_friendly)
  values (v_user_id, v_bot_id, 0, 'settled', v_winner, now(), true) returning id into v_id;

  return query select v_winner, 0::bigint, 'Platform Bot'::text, v_winner = v_user_id;
end; $$;

create or replace function public.play_lightning_duel_vs_bot(
  p_stake bigint default 50,
  p_side text default 'up'
)
returns table (winner_id uuid, payout bigint, bot_name text, strike_price numeric, settle_price numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_winner uuid;
  v_strike numeric := 60000 + floor(random() * 20000);
  v_settle numeric;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_side not in ('up', 'down') then raise exception 'side must be up or down'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  v_settle := v_strike + (random() * 400 - 200);
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
    v_user_id, v_bot_id, 0, p_side, 60,
    v_strike, v_settle, 'settled', v_winner, now(), true
  ) returning id into v_id;

  return query select v_winner, 0::bigint, 'Platform Bot'::text, v_strike, v_settle;
end; $$;

create or replace function public.play_trivia_vs_bot(p_stake bigint default 50)
returns table (your_score int, bot_score int, winner_id uuid, payout bigint, bot_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_y int; v_b int; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  v_y := floor(random() * 6)::int;
  v_b := floor(random() * 6)::int;
  if v_y > v_b then v_winner := v_user_id;
  elsif v_b > v_y then v_winner := v_bot_id;
  else v_winner := case when random() < 0.5 then v_user_id else v_bot_id end;
  end if;

  insert into public.trivia_duels (creator_id, opponent_id, stake, creator_score, opponent_score, status, winner_id, settled_at, is_friendly)
  values (v_user_id, v_bot_id, 0, v_y, v_b, 'settled', v_winner, now(), true) returning id into v_id;

  return query select v_y, v_b, v_winner, 0::bigint, 'Platform Bot'::text;
end; $$;

create or replace function public.play_coin_flip_vs_bot(p_side text)
returns table (won boolean, payout bigint, flip_side text, bot_side text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_bot_id uuid;
  v_bot_side text;
  v_flip text;
  v_won boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_side not in ('heads', 'tails') then raise exception 'pick heads or tails'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  v_bot_side := case when p_side = 'heads' then 'tails' else 'heads' end;
  v_flip := case when random() < 0.5 then 'heads' else 'tails' end;
  v_won := v_flip = p_side;

  return query select v_won, 0::bigint, v_flip, v_bot_side;
end;
$$;

-- ── Skill-board bots (friendly only) ──────────────────────────────────────────

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
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then
    raise exception 'platform bot not configured — admin must register one at /admin';
  end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  insert into public.chess_games (
    creator_id, opponent_id, stake, is_friendly, status, current_turn_id, move_count, fen
  ) values (
    v_user_id, v_bot_id, 0, true, 'matched', v_user_id, 0,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.start_connect4_vs_bot(
  p_friendly boolean default true,
  p_stake bigint default 100
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  if v_bot_id = v_user_id then raise exception 'sign in as your player account, not the bot'; end if;

  insert into public.connect4_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id, board, move_count)
  values (v_user_id, v_bot_id, 0, true, 'active', v_user_id, array_fill(0, array[42])::int[], 0) returning id into v_id;

  return v_id;
end; $$;

create or replace function public.start_checkers_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  insert into public.checkers_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, 0, true, 'active', v_user_id) returning id into v_id;

  return v_id;
end; $$;

create or replace function public.start_go_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  insert into public.go_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, 0, true, 'active', v_user_id) returning id into v_id;

  return v_id;
end; $$;

create or replace function public.start_shogi_vs_bot(p_friendly boolean default true, p_stake bigint default 100)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  insert into public.shogi_games (creator_id, opponent_id, stake, is_friendly, status, current_turn_id)
  values (v_user_id, v_bot_id, 0, true, 'active', v_user_id) returning id into v_id;

  return v_id;
end; $$;

create or replace function public.start_poker_vs_bot(
  p_state jsonb, p_friendly boolean default true, p_stake bigint default 100
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;

  insert into public.poker_games (creator_id, opponent_id, stake, is_friendly, status, state)
  values (v_user_id, v_bot_id, 0, true, 'active', p_state) returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.play_coin_flip_vs_bot(text) from public;
grant execute on function public.play_coin_flip_vs_bot(text) to authenticated;
