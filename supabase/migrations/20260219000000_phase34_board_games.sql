-- =============================================================================
-- Phase 34: Chess, Checkers, Go, Shogi, Prediction Poker (heads-up hold'em)
-- =============================================================================

create or replace function public._settle_skill_duel(
  p_escrow_code   text,
  p_winner_id     uuid,
  p_creator_id    uuid,
  p_opponent_id   uuid,
  p_stake         bigint,
  p_is_friendly   boolean,
  p_game_key      text,
  p_is_draw       boolean,
  p_tx_kind       text,
  p_tx_ref        text,
  p_metadata      jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pool   bigint;
  v_payout bigint;
  v_escrow uuid;
  v_wallet uuid;
  v_mint   uuid;
  v_tx_id  uuid;
  v_loser  uuid;
begin
  if p_stake <= 0 then
    if not p_is_draw and p_winner_id is not null and not p_is_friendly then
      v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
      perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
    elsif p_is_draw and not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;

  if p_is_draw then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (p_tx_kind || '_draw', p_tx_ref || ':draw', p_metadata, p_creator_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_creator_id), p_stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(p_opponent_id), p_stake, 'vibe');
    if not p_is_friendly then
      perform public._apply_game_rating(p_game_key, p_creator_id, p_opponent_id, true);
    end if;
    return;
  end if;

  select public._wallet_for_user(p_winner_id) into v_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_tx_kind, p_tx_ref, p_metadata || jsonb_build_object('winner_id', p_winner_id), p_winner_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  if not p_is_friendly then
    v_loser := case when p_winner_id = p_creator_id then p_opponent_id else p_creator_id end;
    perform public._apply_game_rating(p_game_key, p_winner_id, v_loser, false);
  end if;
end;
$$;

create or replace function public._cancel_skill_duel(
  p_escrow_code text,
  p_creator_id  uuid,
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
begin
  if p_stake <= 0 then return; end if;
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_tx_kind || '_cancel', p_tx_ref || ':cancel', p_metadata, p_creator_id)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -p_stake, 'vibe'),
    (v_tx_id, public._wallet_for_user(p_creator_id), p_stake, 'vibe');
end;
$$;

-- —— Chess ——
create table if not exists public.chess_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check ((is_friendly and stake = 0) or (not is_friendly and stake >= 10 and stake <= 10000)),
  is_friendly      boolean not null default false,
  fen              text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  result_reason    text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists chess_games_open_idx on public.chess_games (status, created_at desc) where status = 'open';
alter table public.chess_games enable row level security;
drop policy if exists chess_games_select on public.chess_games;
create policy chess_games_select on public.chess_games for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null));

create or replace function public._chess_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'chess_escrow:' || p_id::text; $$;

-- —— Checkers ——
create table if not exists public.checkers_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check ((is_friendly and stake = 0) or (not is_friendly and stake >= 10 and stake <= 10000)),
  is_friendly      boolean not null default false,
  board            int[] not null default array[
    0, -1, 0, -1, 0, -1, 0, -1,
    -1, 0, -1, 0, -1, 0, -1, 0,
    0, -1, 0, -1, 0, -1, 0, -1,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 1, 0, 1, 0, 1, 0,
    0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0
  ]::int[],
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists checkers_games_open_idx on public.checkers_games (status, created_at desc) where status = 'open';
alter table public.checkers_games enable row level security;
drop policy if exists checkers_games_select on public.checkers_games;
create policy checkers_games_select on public.checkers_games for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null));

create or replace function public._checkers_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'checkers_escrow:' || p_id::text; $$;

-- —— Go (9×9) ——
create table if not exists public.go_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check ((is_friendly and stake = 0) or (not is_friendly and stake >= 10 and stake <= 10000)),
  is_friendly      boolean not null default false,
  board            int[] not null default array_fill(0, array[81])::int[],
  prev_board       int[],
  pass_count       int not null default 0,
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  black_score      numeric,
  white_score      numeric,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists go_games_open_idx on public.go_games (status, created_at desc) where status = 'open';
alter table public.go_games enable row level security;
drop policy if exists go_games_select on public.go_games;
create policy go_games_select on public.go_games for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null));

create or replace function public._go_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'go_escrow:' || p_id::text; $$;

-- —— Shogi ——
create table if not exists public.shogi_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check ((is_friendly and stake = 0) or (not is_friendly and stake >= 10 and stake <= 10000)),
  is_friendly      boolean not null default false,
  sfen             text not null default 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 0',
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  result_reason    text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists shogi_games_open_idx on public.shogi_games (status, created_at desc) where status = 'open';
alter table public.shogi_games enable row level security;
drop policy if exists shogi_games_select on public.shogi_games;
create policy shogi_games_select on public.shogi_games for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null));

create or replace function public._shogi_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'shogi_escrow:' || p_id::text; $$;

-- —— Poker ——
create table if not exists public.poker_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check ((is_friendly and stake = 0) or (not is_friendly and stake >= 10 and stake <= 10000)),
  is_friendly      boolean not null default false,
  state            jsonb,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  creator_hand_rank text,
  opponent_hand_rank text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists poker_games_open_idx on public.poker_games (status, created_at desc) where status = 'open';
alter table public.poker_games enable row level security;
drop policy if exists poker_games_select on public.poker_games;
create policy poker_games_select on public.poker_games for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null));

create or replace function public._poker_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'poker_escrow:' || p_id::text; $$;

-- Shared create/accept/cancel pattern via macro-like functions per game below.

create or replace function public.create_chess_game(
  p_stake bigint, p_invite_code text default null, p_friendly boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invited uuid; v_id uuid; v_stake bigint; v_friendly boolean := coalesce(p_friendly, false);
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.chess_games (creator_id, stake, invited_user_id, is_friendly) values (v_user_id, v_stake, v_invited, v_friendly) returning id into v_id;
  if v_stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'chess_create', 'chess:' || v_id::text, public._chess_escrow_code(v_id), jsonb_build_object('chess_id', v_id)); end if;
  return v_id;
end; $$;

create or replace function public.accept_chess_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then raise exception 'reserved for another player'; end if;
  if v_game.stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_game.stake, 'chess_accept', 'chess_accept:' || p_game_id::text, public._chess_escrow_code(p_game_id), jsonb_build_object('chess_id', p_game_id)); end if;
  update public.chess_games set opponent_id = v_user_id, status = 'active', current_turn_id = creator_id where id = p_game_id;
end; $$;

create or replace function public.apply_chess_state(
  p_game_id uuid, p_fen text, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_result text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;
  if p_status = 'active' then
    update public.chess_games set fen = p_fen, current_turn_id = p_next_turn_id where id = p_game_id;
    return;
  end if;
  if p_status = 'draw' then
    perform public._settle_skill_duel(public._chess_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'chess', true, 'chess_settle', 'chess:' || p_game_id::text, jsonb_build_object('chess_id', p_game_id));
    update public.chess_games set fen = p_fen, status = 'draw', winner_id = null, current_turn_id = null, result_reason = p_result, settled_at = now() where id = p_game_id;
    return;
  end if;
  perform public._settle_skill_duel(public._chess_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text, jsonb_build_object('chess_id', p_game_id));
  update public.chess_games set fen = p_fen, status = 'settled', winner_id = p_winner_id, current_turn_id = null, result_reason = p_result, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.resign_chess_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype; v_winner uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(public._chess_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'chess', false, 'chess_settle', 'chess:' || p_game_id::text, jsonb_build_object('chess_id', p_game_id, 'reason', 'resignation'));
  update public.chess_games set status = 'settled', winner_id = v_winner, current_turn_id = null, result_reason = 'resignation', settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.cancel_chess_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.chess_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.chess_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.creator_id <> v_user_id then raise exception 'only creator can cancel'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  perform public._cancel_skill_duel(public._chess_escrow_code(p_game_id), v_game.creator_id, v_game.stake, 'chess', 'chess:' || p_game_id::text, jsonb_build_object('chess_id', p_game_id));
  update public.chess_games set status = 'cancelled' where id = p_game_id;
end; $$;

create or replace function public.get_open_chess_games(p_limit int default 20)
returns table (id uuid, creator_id uuid, creator_name text, stake bigint, is_friendly boolean, invited_user_id uuid, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(p.display_name, 'Player') as creator_name, g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.chess_games g join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and (g.invited_user_id is null or g.invited_user_id = auth.uid())
  order by g.created_at desc limit p_limit;
$$;

create or replace function public.get_chess_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, fen text, current_turn_id uuid, status text,
  winner_id uuid, result_reason text, invited_user_id uuid
) language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly,
    g.fen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id
  from public.chess_games g
  join public.profiles cp on cp.id = g.creator_id
  left join public.profiles op on op.id = g.opponent_id
  where g.id = p_game_id;
$$;

-- Checkers RPCs (state validated in app layer)
create or replace function public.create_checkers_game(p_stake bigint, p_invite_code text default null, p_friendly boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invited uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when coalesce(p_friendly, false) then 0 else p_stake end;
  if not coalesce(p_friendly, false) and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.checkers_games (creator_id, stake, invited_user_id, is_friendly) values (v_user_id, v_stake, v_invited, coalesce(p_friendly, false)) returning id into v_id;
  if v_stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'checkers_create', 'checkers:' || v_id::text, public._checkers_escrow_code(v_id), jsonb_build_object('checkers_id', v_id)); end if;
  return v_id;
end; $$;

create or replace function public.accept_checkers_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then raise exception 'reserved for another player'; end if;
  if v_game.stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_game.stake, 'checkers_accept', 'checkers_accept:' || p_game_id::text, public._checkers_escrow_code(p_game_id), jsonb_build_object('checkers_id', p_game_id)); end if;
  update public.checkers_games set opponent_id = v_user_id, status = 'active', current_turn_id = creator_id where id = p_game_id;
end; $$;

create or replace function public.apply_checkers_state(p_game_id uuid, p_board int[], p_next_turn_id uuid, p_status text, p_winner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;
  if p_status = 'active' then
    update public.checkers_games set board = p_board, current_turn_id = p_next_turn_id where id = p_game_id;
    return;
  end if;
  if p_status = 'draw' then
    perform public._settle_skill_duel(public._checkers_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'checkers', true, 'checkers_settle', 'checkers:' || p_game_id::text, jsonb_build_object('checkers_id', p_game_id));
    update public.checkers_games set board = p_board, status = 'draw', winner_id = null, current_turn_id = null, settled_at = now() where id = p_game_id;
    return;
  end if;
  perform public._settle_skill_duel(public._checkers_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'checkers', false, 'checkers_settle', 'checkers:' || p_game_id::text, jsonb_build_object('checkers_id', p_game_id));
  update public.checkers_games set board = p_board, status = 'settled', winner_id = p_winner_id, current_turn_id = null, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.cancel_checkers_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.checkers_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.checkers_games where id = p_game_id for update;
  if v_game.creator_id <> v_user_id or v_game.status <> 'open' then raise exception 'cannot cancel'; end if;
  perform public._cancel_skill_duel(public._checkers_escrow_code(p_game_id), v_game.creator_id, v_game.stake, 'checkers', 'checkers:' || p_game_id::text, jsonb_build_object('checkers_id', p_game_id));
  update public.checkers_games set status = 'cancelled' where id = p_game_id;
end; $$;

create or replace function public.get_open_checkers_games(p_limit int default 20)
returns table (id uuid, creator_id uuid, creator_name text, stake bigint, is_friendly boolean, invited_user_id uuid, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(p.display_name, 'Player'), g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.checkers_games g join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and (g.invited_user_id is null or g.invited_user_id = auth.uid())
  order by g.created_at desc limit p_limit;
$$;

create or replace function public.get_checkers_game(p_game_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text, stake bigint, is_friendly boolean, board int[], current_turn_id uuid, status text, winner_id uuid, invited_user_id uuid)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly, g.board, g.current_turn_id, g.status, g.winner_id, g.invited_user_id
  from public.checkers_games g join public.profiles cp on cp.id = g.creator_id left join public.profiles op on op.id = g.opponent_id where g.id = p_game_id;
$$;

-- Go RPCs
create or replace function public.create_go_game(p_stake bigint, p_invite_code text default null, p_friendly boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invited uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when coalesce(p_friendly, false) then 0 else p_stake end;
  if not coalesce(p_friendly, false) and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.go_games (creator_id, stake, invited_user_id, is_friendly) values (v_user_id, v_stake, v_invited, coalesce(p_friendly, false)) returning id into v_id;
  if v_stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'go_create', 'go:' || v_id::text, public._go_escrow_code(v_id), jsonb_build_object('go_id', v_id)); end if;
  return v_id;
end; $$;

create or replace function public.accept_go_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if v_game.status <> 'open' or v_game.creator_id = v_user_id then raise exception 'cannot join'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then raise exception 'reserved'; end if;
  if v_game.stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_game.stake, 'go_accept', 'go_accept:' || p_game_id::text, public._go_escrow_code(p_game_id), jsonb_build_object('go_id', p_game_id)); end if;
  update public.go_games set opponent_id = v_user_id, status = 'active', current_turn_id = creator_id where id = p_game_id;
end; $$;

create or replace function public.apply_go_state(
  p_game_id uuid, p_board int[], p_prev_board int[], p_pass_count int, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_black_score numeric default null, p_white_score numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_game from public.go_games where id = p_game_id for update;
  if v_game.status <> 'active' or v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;
  if p_status = 'active' then
    update public.go_games set board = p_board, prev_board = p_prev_board, pass_count = p_pass_count, current_turn_id = p_next_turn_id where id = p_game_id;
    return;
  end if;
  if p_status = 'draw' then
    perform public._settle_skill_duel(public._go_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'go', true, 'go_settle', 'go:' || p_game_id::text, jsonb_build_object('go_id', p_game_id));
    update public.go_games set board = p_board, status = 'draw', winner_id = null, black_score = p_black_score, white_score = p_white_score, current_turn_id = null, settled_at = now() where id = p_game_id;
    return;
  end if;
  perform public._settle_skill_duel(public._go_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'go', false, 'go_settle', 'go:' || p_game_id::text, jsonb_build_object('go_id', p_game_id));
  update public.go_games set board = p_board, status = 'settled', winner_id = p_winner_id, black_score = p_black_score, white_score = p_white_score, current_turn_id = null, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.resign_go_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype; v_winner uuid;
begin
  select * into v_game from public.go_games where id = p_game_id for update;
  if v_game.status <> 'active' then raise exception 'not active'; end if;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(public._go_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'go', false, 'go_settle', 'go:' || p_game_id::text, jsonb_build_object('go_id', p_game_id));
  update public.go_games set status = 'settled', winner_id = v_winner, current_turn_id = null, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.cancel_go_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.go_games%rowtype;
begin
  select * into v_game from public.go_games where id = p_game_id for update;
  if v_game.creator_id <> v_user_id or v_game.status <> 'open' then raise exception 'cannot cancel'; end if;
  perform public._cancel_skill_duel(public._go_escrow_code(p_game_id), v_game.creator_id, v_game.stake, 'go', 'go:' || p_game_id::text, jsonb_build_object('go_id', p_game_id));
  update public.go_games set status = 'cancelled' where id = p_game_id;
end; $$;

create or replace function public.get_open_go_games(p_limit int default 20)
returns table (id uuid, creator_id uuid, creator_name text, stake bigint, is_friendly boolean, invited_user_id uuid, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(p.display_name, 'Player'), g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.go_games g join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and (g.invited_user_id is null or g.invited_user_id = auth.uid()) order by g.created_at desc limit p_limit;
$$;

create or replace function public.get_go_game(p_game_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text, stake bigint, is_friendly boolean, board int[], prev_board int[], pass_count int, current_turn_id uuid, status text, winner_id uuid, black_score numeric, white_score numeric, invited_user_id uuid)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly, g.board, g.prev_board, g.pass_count, g.current_turn_id, g.status, g.winner_id, g.black_score, g.white_score, g.invited_user_id
  from public.go_games g join public.profiles cp on cp.id = g.creator_id left join public.profiles op on op.id = g.opponent_id where g.id = p_game_id;
$$;

-- Shogi RPCs (SFEN validated in app)
create or replace function public.create_shogi_game(p_stake bigint, p_invite_code text default null, p_friendly boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invited uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when coalesce(p_friendly, false) then 0 else p_stake end;
  if not coalesce(p_friendly, false) and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.shogi_games (creator_id, stake, invited_user_id, is_friendly) values (v_user_id, v_stake, v_invited, coalesce(p_friendly, false)) returning id into v_id;
  if v_stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'shogi_create', 'shogi:' || v_id::text, public._shogi_escrow_code(v_id), jsonb_build_object('shogi_id', v_id)); end if;
  return v_id;
end; $$;

create or replace function public.accept_shogi_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if v_game.status <> 'open' or v_game.creator_id = v_user_id then raise exception 'cannot join'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then raise exception 'reserved'; end if;
  if v_game.stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_game.stake, 'shogi_accept', 'shogi_accept:' || p_game_id::text, public._shogi_escrow_code(p_game_id), jsonb_build_object('shogi_id', p_game_id)); end if;
  update public.shogi_games set opponent_id = v_user_id, status = 'active', current_turn_id = creator_id where id = p_game_id;
end; $$;

create or replace function public.apply_shogi_state(p_game_id uuid, p_sfen text, p_next_turn_id uuid, p_status text, p_winner_id uuid, p_result text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if v_game.status <> 'active' or v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;
  if p_status = 'active' then
    update public.shogi_games set sfen = p_sfen, current_turn_id = p_next_turn_id where id = p_game_id;
    return;
  end if;
  if p_status = 'draw' then
    perform public._settle_skill_duel(public._shogi_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'shogi', true, 'shogi_settle', 'shogi:' || p_game_id::text, jsonb_build_object('shogi_id', p_game_id));
    update public.shogi_games set sfen = p_sfen, status = 'draw', winner_id = null, result_reason = p_result, current_turn_id = null, settled_at = now() where id = p_game_id;
    return;
  end if;
  perform public._settle_skill_duel(public._shogi_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'shogi', false, 'shogi_settle', 'shogi:' || p_game_id::text, jsonb_build_object('shogi_id', p_game_id));
  update public.shogi_games set sfen = p_sfen, status = 'settled', winner_id = p_winner_id, result_reason = p_result, current_turn_id = null, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.resign_shogi_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype; v_winner uuid;
begin
  select * into v_game from public.shogi_games where id = p_game_id for update;
  v_winner := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
  perform public._settle_skill_duel(public._shogi_escrow_code(p_game_id), v_winner, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'shogi', false, 'shogi_settle', 'shogi:' || p_game_id::text, jsonb_build_object('shogi_id', p_game_id));
  update public.shogi_games set status = 'settled', winner_id = v_winner, result_reason = 'resignation', current_turn_id = null, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.cancel_shogi_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.shogi_games%rowtype;
begin
  select * into v_game from public.shogi_games where id = p_game_id for update;
  if v_game.creator_id <> v_user_id or v_game.status <> 'open' then raise exception 'cannot cancel'; end if;
  perform public._cancel_skill_duel(public._shogi_escrow_code(p_game_id), v_game.creator_id, v_game.stake, 'shogi', 'shogi:' || p_game_id::text, jsonb_build_object('shogi_id', p_game_id));
  update public.shogi_games set status = 'cancelled' where id = p_game_id;
end; $$;

create or replace function public.get_open_shogi_games(p_limit int default 20)
returns table (id uuid, creator_id uuid, creator_name text, stake bigint, is_friendly boolean, invited_user_id uuid, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(p.display_name, 'Player'), g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.shogi_games g join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and (g.invited_user_id is null or g.invited_user_id = auth.uid()) order by g.created_at desc limit p_limit;
$$;

create or replace function public.get_shogi_game(p_game_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text, stake bigint, is_friendly boolean, sfen text, current_turn_id uuid, status text, winner_id uuid, result_reason text, invited_user_id uuid)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, cp.display_name, g.opponent_id, op.display_name, g.stake, g.is_friendly, g.sfen, g.current_turn_id, g.status, g.winner_id, g.result_reason, g.invited_user_id
  from public.shogi_games g join public.profiles cp on cp.id = g.creator_id left join public.profiles op on op.id = g.opponent_id where g.id = p_game_id;
$$;

-- Poker RPCs
create or replace function public.create_poker_game(p_stake bigint, p_invite_code text default null, p_friendly boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invited uuid; v_id uuid; v_stake bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when coalesce(p_friendly, false) then 0 else p_stake end;
  if not coalesce(p_friendly, false) and (v_stake < 10 or v_stake > 10000) then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_invited := public._resolve_invited_user(p_invite_code);
  insert into public.poker_games (creator_id, stake, invited_user_id, is_friendly) values (v_user_id, v_stake, v_invited, coalesce(p_friendly, false)) returning id into v_id;
  if v_stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_stake, 'poker_create', 'poker:' || v_id::text, public._poker_escrow_code(v_id), jsonb_build_object('poker_id', v_id)); end if;
  return v_id;
end; $$;

create or replace function public.accept_poker_game(p_game_id uuid, p_state jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.poker_games%rowtype;
begin
  select * into v_game from public.poker_games where id = p_game_id for update;
  if v_game.status <> 'open' or v_game.creator_id = v_user_id then raise exception 'cannot join'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then raise exception 'reserved'; end if;
  if v_game.stake > 0 then perform public._debit_wallet_to_escrow(v_user_id, v_game.stake, 'poker_accept', 'poker_accept:' || p_game_id::text, public._poker_escrow_code(p_game_id), jsonb_build_object('poker_id', p_game_id)); end if;
  update public.poker_games set opponent_id = v_user_id, status = 'active', state = p_state where id = p_game_id;
end; $$;

create or replace function public.update_poker_state(p_game_id uuid, p_state jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.poker_games%rowtype;
begin
  select * into v_game from public.poker_games where id = p_game_id for update;
  if v_game.status <> 'active' then raise exception 'not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  update public.poker_games set state = p_state where id = p_game_id;
end; $$;

create or replace function public.settle_poker_game(
  p_game_id uuid, p_winner_id uuid, p_is_draw boolean, p_state jsonb, p_creator_rank text, p_opponent_rank text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.poker_games%rowtype;
begin
  select * into v_game from public.poker_games where id = p_game_id for update;
  if v_game.status <> 'active' then raise exception 'not active'; end if;
  if v_user_id not in (v_game.creator_id, v_game.opponent_id) then raise exception 'not a player'; end if;
  if p_is_draw then
    perform public._settle_skill_duel(public._poker_escrow_code(p_game_id), null, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'poker', true, 'poker_settle', 'poker:' || p_game_id::text, jsonb_build_object('poker_id', p_game_id));
    update public.poker_games set state = p_state, status = 'draw', winner_id = null, creator_hand_rank = p_creator_rank, opponent_hand_rank = p_opponent_rank, settled_at = now() where id = p_game_id;
    return;
  end if;
  perform public._settle_skill_duel(public._poker_escrow_code(p_game_id), p_winner_id, v_game.creator_id, v_game.opponent_id, v_game.stake, v_game.is_friendly, 'poker', false, 'poker_settle', 'poker:' || p_game_id::text, jsonb_build_object('poker_id', p_game_id));
  update public.poker_games set state = p_state, status = 'settled', winner_id = p_winner_id, creator_hand_rank = p_creator_rank, opponent_hand_rank = p_opponent_rank, settled_at = now() where id = p_game_id;
end; $$;

create or replace function public.cancel_poker_game(p_game_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_game public.poker_games%rowtype;
begin
  select * into v_game from public.poker_games where id = p_game_id for update;
  if v_game.creator_id <> v_user_id or v_game.status <> 'open' then raise exception 'cannot cancel'; end if;
  perform public._cancel_skill_duel(public._poker_escrow_code(p_game_id), v_game.creator_id, v_game.stake, 'poker', 'poker:' || p_game_id::text, jsonb_build_object('poker_id', p_game_id));
  update public.poker_games set status = 'cancelled' where id = p_game_id;
end; $$;

create or replace function public.get_open_poker_games(p_limit int default 20)
returns table (id uuid, creator_id uuid, creator_name text, stake bigint, is_friendly boolean, invited_user_id uuid, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select g.id, g.creator_id, coalesce(p.display_name, 'Player'), g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.poker_games g join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and (g.invited_user_id is null or g.invited_user_id = auth.uid()) order by g.created_at desc limit p_limit;
$$;

create or replace function public.get_poker_game(p_game_id uuid)
returns table (
  id uuid, creator_id uuid, creator_name text, opponent_id uuid, opponent_name text,
  stake bigint, is_friendly boolean, state jsonb, status text, winner_id uuid,
  creator_hand_rank text, opponent_hand_rank text, invited_user_id uuid
) language plpgsql security definer set search_path = '' stable as $$
declare v_uid uuid := auth.uid(); v_game public.poker_games%rowtype; v_state jsonb; v_role text;
begin
  select * into v_game from public.poker_games where id = p_game_id;
  if not found then return; end if;
  if v_uid = v_game.creator_id then v_role := 'creator';
  elsif v_uid = v_game.opponent_id then v_role := 'opponent';
  else v_role := 'spectator';
  end if;
  v_state := v_game.state;
  if v_state is not null and v_game.status = 'active' and (v_state->>'phase') <> 'showdown' then
    if v_role = 'creator' then
      v_state := jsonb_set(v_state, '{hole,opponent}', '["??","??"]'::jsonb);
    elsif v_role = 'opponent' then
      v_state := jsonb_set(v_state, '{hole,creator}', '["??","??"]'::jsonb);
    else
      v_state := jsonb_set(jsonb_set(v_state, '{hole,creator}', '["??","??"]'::jsonb), '{hole,opponent}', '["??","??"]'::jsonb);
    end if;
  end if;
  return query
  select v_game.id, v_game.creator_id, cp.display_name, v_game.opponent_id, op.display_name,
    v_game.stake, v_game.is_friendly, v_state, v_game.status, v_game.winner_id,
    v_game.creator_hand_rank, v_game.opponent_hand_rank, v_game.invited_user_id
  from public.profiles cp left join public.profiles op on op.id = v_game.opponent_id
  where cp.id = v_game.creator_id;
end; $$;

-- Grants
do $g$
declare f text;
begin
  foreach f in array array[
    'create_chess_game','accept_chess_game','apply_chess_state','resign_chess_game','cancel_chess_game','get_open_chess_games','get_chess_game',
    'create_checkers_game','accept_checkers_game','apply_checkers_state','cancel_checkers_game','get_open_checkers_games','get_checkers_game',
    'create_go_game','accept_go_game','apply_go_state','resign_go_game','cancel_go_game','get_open_go_games','get_go_game',
    'create_shogi_game','accept_shogi_game','apply_shogi_state','resign_shogi_game','cancel_shogi_game','get_open_shogi_games','get_shogi_game',
    'create_poker_game','accept_poker_game','update_poker_state','settle_poker_game','cancel_poker_game','get_open_poker_games','get_poker_game'
  ] loop
    execute format('revoke execute on function public.%I from public', split_part(f, '(', 1));
  end loop;
end $g$;

grant execute on function public.create_chess_game(bigint, text, boolean) to authenticated;
grant execute on function public.accept_chess_game(uuid) to authenticated;
grant execute on function public.apply_chess_state(uuid, text, uuid, text, uuid, text) to authenticated;
grant execute on function public.resign_chess_game(uuid) to authenticated;
grant execute on function public.cancel_chess_game(uuid) to authenticated;
grant execute on function public.get_open_chess_games(int) to authenticated;
grant execute on function public.get_chess_game(uuid) to authenticated;

grant execute on function public.create_checkers_game(bigint, text, boolean) to authenticated;
grant execute on function public.accept_checkers_game(uuid) to authenticated;
grant execute on function public.apply_checkers_state(uuid, int[], uuid, text, uuid) to authenticated;
grant execute on function public.cancel_checkers_game(uuid) to authenticated;
grant execute on function public.get_open_checkers_games(int) to authenticated;
grant execute on function public.get_checkers_game(uuid) to authenticated;

grant execute on function public.create_go_game(bigint, text, boolean) to authenticated;
grant execute on function public.accept_go_game(uuid) to authenticated;
grant execute on function public.apply_go_state(uuid, int[], int[], int, uuid, text, uuid, numeric, numeric) to authenticated;
grant execute on function public.resign_go_game(uuid) to authenticated;
grant execute on function public.cancel_go_game(uuid) to authenticated;
grant execute on function public.get_open_go_games(int) to authenticated;
grant execute on function public.get_go_game(uuid) to authenticated;

grant execute on function public.create_shogi_game(bigint, text, boolean) to authenticated;
grant execute on function public.accept_shogi_game(uuid) to authenticated;
grant execute on function public.apply_shogi_state(uuid, text, uuid, text, uuid, text) to authenticated;
grant execute on function public.resign_shogi_game(uuid) to authenticated;
grant execute on function public.cancel_shogi_game(uuid) to authenticated;
grant execute on function public.get_open_shogi_games(int) to authenticated;
grant execute on function public.get_shogi_game(uuid) to authenticated;

grant execute on function public.create_poker_game(bigint, text, boolean) to authenticated;
grant execute on function public.accept_poker_game(uuid, jsonb) to authenticated;
grant execute on function public.update_poker_state(uuid, jsonb) to authenticated;
grant execute on function public.settle_poker_game(uuid, uuid, boolean, jsonb, text, text) to authenticated;
grant execute on function public.cancel_poker_game(uuid) to authenticated;
grant execute on function public.get_open_poker_games(int) to authenticated;
grant execute on function public.get_poker_game(uuid) to authenticated;

insert into public.feature_flags (key, enabled, description) values
  ('chess_enabled', false, 'Chess duels at /games/duels/chess'),
  ('checkers_enabled', false, 'Checkers duels at /games/duels/checkers'),
  ('go_enabled', false, 'Go (9×9) duels at /games/duels/go'),
  ('shogi_enabled', false, 'Shogi duels at /games/duels/shogi'),
  ('poker_enabled', false, 'Heads-up hold''em showdown at /games/duels/poker')
on conflict (key) do update set description = excluded.description;
