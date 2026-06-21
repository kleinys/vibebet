-- =============================================================================
-- Phase 31: Connect Four + friend invites by player code + friendly matches
-- =============================================================================

-- Player codes live on profiles.referral_code (Phase 19). Ensure column exists
-- so this migration runs even if Phase 19 was skipped.
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users(id) on delete set null;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code)
  where referral_code is not null;

do $$
declare
  r record;
  v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    while exists (select 1 from public.profiles p where p.referral_code = v_code) loop
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end;
$$;

-- Resolve @username or referral code (e.g. ABC12345) to a user id.
create or replace function public.resolve_player_code(p_code text)
returns table (
  user_id       uuid,
  display_name  text,
  username      text,
  referral_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_normalized text := upper(trim(p_code));
  v_stripped   text := trim(both '@' from trim(p_code));
  v_rec        record;
begin
  if length(trim(p_code)) < 2 then
    raise exception 'enter a valid player code or @username';
  end if;

  select p.id, p.display_name, p.username, p.referral_code into v_rec
  from public.profiles p
  where upper(p.referral_code) = v_normalized
     or (p.username is not null and lower(p.username) = lower(v_stripped))
  limit 1;

  if v_rec.id is null then
    raise exception 'no player found for code %', p_code;
  end if;

  return query select v_rec.id, v_rec.display_name, v_rec.username, v_rec.referral_code;
end;
$$;

create or replace function public.get_my_player_code()
returns table (
  referral_code text,
  username      text,
  display_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.referral_code, p.username, p.display_name
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Friend invite columns on existing duel tables
alter table public.rps_duels
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_friendly boolean not null default false;

alter table public.high_card_duels
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_friendly boolean not null default false;

alter table public.lightning_duels
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_friendly boolean not null default false;

alter table public.trivia_duels
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_friendly boolean not null default false;

-- Allow zero stake on friendly duels (rated duels still require 10–10,000 VIBE).
alter table public.rps_duels drop constraint if exists rps_duels_stake_check;
alter table public.rps_duels add constraint rps_duels_stake_check check (
  (is_friendly and stake = 0)
  or (not is_friendly and stake >= 10 and stake <= 10000)
);

-- —— Connect Four ——
create table if not exists public.connect4_games (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  invited_user_id  uuid references auth.users(id) on delete set null,
  stake            bigint not null default 0
    check (
      (is_friendly and stake = 0)
      or (not is_friendly and stake >= 10 and stake <= 10000)
    ),
  is_friendly      boolean not null default false,
  board            int[] not null default array_fill(0, array[42])::int[],
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'draw')),
  winner_id        uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists connect4_games_open_idx
  on public.connect4_games (status, created_at desc) where status = 'open';

create index if not exists connect4_games_active_idx
  on public.connect4_games (status) where status = 'active';

alter table public.connect4_games enable row level security;

drop policy if exists connect4_games_select on public.connect4_games;
create policy connect4_games_select on public.connect4_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
  );

create or replace function public._connect4_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'connect4_escrow:' || p_id::text; $$;

create or replace function public._connect4_col_row(
  p_board int[],
  p_col int,
  out row_idx int,
  out ok boolean
)
returns record
language plpgsql
immutable
as $$
declare
  v_r int;
begin
  ok := false;
  row_idx := -1;
  if p_col < 0 or p_col > 6 then return; end if;
  for v_r in reverse 5..0 loop
    if p_board[v_r * 7 + p_col + 1] = 0 then
      row_idx := v_r;
      ok := true;
      return;
    end if;
  end loop;
end;
$$;

create or replace function public._connect4_check_win(p_board int[], p_player int)
returns boolean
language plpgsql
immutable
as $$
declare
  r int;
  c int;
  dr int[];
  dc int[];
  i int;
  cnt int;
  nr int;
  nc int;
begin
  dr := array[0, 0, 1, 1];
  dc := array[1, 0, 1, -1];
  for r in 0..5 loop
    for c in 0..6 loop
      if p_board[r * 7 + c + 1] <> p_player then continue; end if;
      for i in 1..4 loop
        cnt := 1;
        for step in 1..3 loop
          nr := r + dr[i] * step;
          nc := c + dc[i] * step;
          if nr < 0 or nr > 5 or nc < 0 or nc > 6 then exit; end if;
          if p_board[nr * 7 + nc + 1] = p_player then
            cnt := cnt + 1;
          else
            exit;
          end if;
        end loop;
        if cnt >= 4 then return true; end if;
      end loop;
    end loop;
  end loop;
  return false;
end;
$$;

create or replace function public._connect4_board_full(p_board int[])
returns boolean
language sql
immutable
as $$
  select not exists (select 1 from unnest(p_board) v where v = 0);
$$;

create or replace function public._resolve_invited_user(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return null;
  end if;
  select user_id into v_user_id from public.resolve_player_code(p_code);
  if v_user_id = auth.uid() then
    raise exception 'cannot challenge yourself';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.create_connect4_game(
  p_stake       bigint,
  p_invite_code text default null,
  p_friendly    boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_invited   uuid;
  v_id        uuid;
  v_friendly  boolean := coalesce(p_friendly, false);
  v_stake     bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  v_friendly := coalesce(p_friendly, false);
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.connect4_games (creator_id, stake, invited_user_id, is_friendly)
  values (v_user_id, v_stake, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'connect4_create', 'connect4:' || v_id::text,
      public._connect4_escrow_code(v_id),
      jsonb_build_object('connect4_id', v_id, 'friendly', v_friendly)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.accept_connect4_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.connect4_games%rowtype;
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
      public._connect4_escrow_code(p_game_id),
      jsonb_build_object('connect4_id', p_game_id)
    );
  end if;

  update public.connect4_games set
    opponent_id = v_user_id,
    status = 'active',
    current_turn_id = v_game.creator_id
  where id = p_game_id;
end;
$$;

create or replace function public.play_connect4_move(p_game_id uuid, p_col int)
returns table (
  winner_id uuid,
  is_draw   boolean,
  row_played int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_game      public.connect4_games%rowtype;
  v_row       int;
  v_ok        boolean;
  v_piece     int;
  v_winner    uuid;
  v_pool      bigint;
  v_payout    bigint;
  v_wallet    uuid;
  v_mint      uuid;
  v_escrow    uuid;
  v_tx_id     uuid;
  v_loser     uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_col < 0 or p_col > 6 then raise exception 'column must be 0–6'; end if;

  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  select r.row_idx, r.ok into v_row, v_ok from public._connect4_col_row(v_game.board, p_col) r;
  if not v_ok then raise exception 'column full'; end if;

  v_piece := case when v_user_id = v_game.creator_id then 1 else 2 end;
  v_game.board[v_row * 7 + p_col + 1] := v_piece;

  if public._connect4_check_win(v_game.board, v_piece) then
    v_winner := v_user_id;
  elsif public._connect4_board_full(v_game.board) then
    v_winner := null;
  else
    update public.connect4_games set
      board = v_game.board,
      current_turn_id = case
        when v_user_id = creator_id then opponent_id
        else creator_id
      end
    where id = p_game_id;
    return query select null::uuid, false, v_row;
    return;
  end if;

  v_pool := v_game.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  if v_game.stake > 0 then
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._connect4_escrow_code(p_game_id);

  if v_winner is not null then
    select public._wallet_for_user(v_winner) into v_wallet;
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('connect4_settle', 'connect4_settle:' || p_game_id::text,
      jsonb_build_object('connect4_id', p_game_id, 'winner_id', v_winner), v_winner)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
  else
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('connect4_draw', 'connect4_draw:' || p_game_id::text,
      jsonb_build_object('connect4_id', p_game_id), v_game.creator_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_game.creator_id), v_game.stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_game.opponent_id), v_game.stake, 'vibe');
  end if;
  end if;

  if v_winner is not null then
    v_loser := case when v_winner = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;
    if not v_game.is_friendly then
      perform public._apply_game_rating('connect4', v_winner, v_loser, false);
    end if;

    update public.connect4_games set
      board = v_game.board, status = 'settled', winner_id = v_winner,
      current_turn_id = null, settled_at = now()
    where id = p_game_id;

    return query select v_winner, false, v_row;
  else
    update public.connect4_games set
      board = v_game.board, status = 'draw', winner_id = null,
      current_turn_id = null, settled_at = now()
    where id = p_game_id;

    return query select null::uuid, true, v_row;
  end if;
end;
$$;

create or replace function public.cancel_connect4_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.connect4_games%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_game from public.connect4_games where id = p_game_id for update;
  if not found or v_game.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_game.status <> 'open' then raise exception 'not open'; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._connect4_escrow_code(p_game_id);
  select public._wallet_for_user(v_game.creator_id) into v_wallet;

  if v_escrow is not null and v_wallet is not null and v_game.stake > 0 then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('connect4_cancel', 'connect4_cancel:' || p_game_id::text,
      jsonb_build_object('connect4_id', p_game_id), v_user_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_game.stake, 'vibe'),
      (v_tx_id, v_wallet, v_game.stake, 'vibe');
  end if;

  update public.connect4_games set status = 'cancelled' where id = p_game_id;
end;
$$;

create or replace function public.get_open_connect4_games(p_limit int default 20)
returns table (
  id            uuid,
  creator_id    uuid,
  creator_name  text,
  stake         bigint,
  is_friendly   boolean,
  invited_user_id uuid,
  created_at    timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.connect4_games g
  left join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and g.expires_at > now()
    and (g.invited_user_id is null or g.invited_user_id = auth.uid())
  order by g.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.get_connect4_game(p_game_id uuid)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  opponent_id     uuid,
  opponent_name   text,
  invited_user_id uuid,
  stake           bigint,
  is_friendly     boolean,
  board           int[],
  current_turn_id uuid,
  status          text,
  winner_id       uuid,
  settled_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    g.id, g.creator_id, coalesce(pc.display_name, 'Player') as creator_name,
    g.opponent_id, coalesce(po.display_name, 'Player') as opponent_name,
    g.invited_user_id, g.stake, g.is_friendly, g.board, g.current_turn_id,
    g.status, g.winner_id, g.settled_at
  from public.connect4_games g
  left join public.profiles pc on pc.id = g.creator_id
  left join public.profiles po on po.id = g.opponent_id
  where g.id = p_game_id;
$$;

-- Patch RPS create to support invites + friendly
-- Must drop first: PostgreSQL cannot change return type / arg list via CREATE OR REPLACE.
drop function if exists public.get_open_rps_duels(int);
drop function if exists public.create_rps_duel(bigint, text);
drop function if exists public.create_rps_duel(bigint, text, text, boolean);

create or replace function public.create_rps_duel(
  p_stake       bigint,
  p_move        text,
  p_invite_code text default null,
  p_friendly    boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invited uuid;
  v_id      uuid;
  v_friendly boolean := coalesce(p_friendly, false);
  v_stake   bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_move not in ('rock', 'paper', 'scissors') then raise exception 'pick rock, paper, or scissors'; end if;

  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.rps_duels (creator_id, stake, creator_move, invited_user_id, is_friendly)
  values (v_user_id, v_stake, p_move, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'rps_duel_create', 'rps_duel:' || v_id::text,
      public._rps_escrow_code(v_id),
      jsonb_build_object('rps_duel_id', v_id)
    );
  end if;

  return v_id;
end;
$$;

-- Patch accept_rps to check invite + skip rating if friendly
create or replace function public.accept_rps_duel(
  p_duel_id uuid,
  p_move    text
) returns table (
  creator_move  text,
  opponent_move text,
  winner_id     uuid,
  payout        bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_duel           public.rps_duels%rowtype;
  v_result         int;
  v_winner_id      uuid;
  v_pool           bigint;
  v_payout         bigint;
  v_winner_wallet  uuid;
  v_mint           uuid;
  v_escrow         uuid;
  v_tx_id          uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_move not in ('rock', 'paper', 'scissors') then raise exception 'pick rock, paper, or scissors'; end if;

  select * into v_duel from public.rps_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel not open'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot accept your own duel'; end if;
  if v_duel.invited_user_id is not null and v_duel.invited_user_id <> v_user_id then
    raise exception 'this duel is reserved for another player';
  end if;

  if v_duel.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_duel.stake, 'rps_duel_accept', 'rps_accept:' || p_duel_id::text,
      public._rps_escrow_code(p_duel_id),
      jsonb_build_object('rps_duel_id', p_duel_id)
    );
  end if;

  v_result := public._rps_winner(v_duel.creator_move, p_move);
  if v_result = 1 then v_winner_id := v_duel.creator_id;
  elsif v_result = -1 then v_winner_id := v_user_id;
  else v_winner_id := null;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  if v_duel.stake > 0 then
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._rps_escrow_code(p_duel_id);

  if v_winner_id is not null then
    select public._wallet_for_user(v_winner_id) into v_winner_wallet;
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_settle', 'rps_settle:' || p_duel_id::text,
      jsonb_build_object('rps_duel_id', p_duel_id, 'winner_id', v_winner_id), v_winner_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
  else
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_draw', 'rps_draw:' || p_duel_id::text,
      jsonb_build_object('rps_duel_id', p_duel_id), v_duel.creator_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_user_id), v_duel.stake, 'vibe');
  end if;
  end if;

  if v_winner_id is not null and not v_duel.is_friendly then
    perform public._apply_game_rating('rps', v_winner_id, v_user_id, false);
  end if;

  update public.rps_duels set
    opponent_id = v_user_id, opponent_move = p_move,
    status = 'settled', winner_id = v_winner_id, settled_at = now()
  where id = p_duel_id;

  return query select v_duel.creator_move, p_move, v_winner_id, coalesce(v_payout, 0::bigint);
end;
$$;

create or replace function public.get_open_rps_duels(p_limit int default 20)
returns table (
  id           uuid,
  creator_id   uuid,
  creator_name text,
  stake        bigint,
  is_friendly  boolean,
  invited_user_id uuid,
  created_at   timestamptz,
  expires_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.is_friendly, d.invited_user_id, d.created_at, d.expires_at
  from public.rps_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
    and (d.invited_user_id is null or d.invited_user_id = auth.uid())
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.resolve_player_code(text) from public;
grant execute on function public.resolve_player_code(text) to authenticated;
revoke execute on function public.get_my_player_code() from public;
grant execute on function public.get_my_player_code() to authenticated;
revoke execute on function public.create_connect4_game(bigint, text, boolean) from public;
grant execute on function public.create_connect4_game(bigint, text, boolean) to authenticated;
revoke execute on function public.accept_connect4_game(uuid) from public;
grant execute on function public.accept_connect4_game(uuid) to authenticated;
revoke execute on function public.play_connect4_move(uuid, int) from public;
grant execute on function public.play_connect4_move(uuid, int) to authenticated;
revoke execute on function public.cancel_connect4_game(uuid) from public;
grant execute on function public.cancel_connect4_game(uuid) to authenticated;
revoke execute on function public.get_open_connect4_games(int) from public;
grant execute on function public.get_open_connect4_games(int) to authenticated;
revoke execute on function public.get_connect4_game(uuid) from public;
grant execute on function public.get_connect4_game(uuid) to authenticated;
revoke execute on function public.create_rps_duel(bigint, text, text, boolean) from public;
grant execute on function public.create_rps_duel(bigint, text, text, boolean) to authenticated;
revoke execute on function public.get_open_rps_duels(int) from public;
grant execute on function public.get_open_rps_duels(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('connect4_enabled', false, 'Connect Four skill game at /games/duels/connect4')
on conflict (key) do update set description = excluded.description;
