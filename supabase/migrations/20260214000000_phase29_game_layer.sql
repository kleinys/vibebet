-- =============================================================================
-- Phase 29: Game layer — ratings, matchmaking queue, RPS + High Card duels
-- =============================================================================

create table if not exists public.game_player_ratings (
  user_id       uuid not null references auth.users(id) on delete cascade,
  game_key      text not null,
  rating        int not null default 1200 check (rating >= 0 and rating <= 4000),
  games_played  int not null default 0 check (games_played >= 0),
  wins          int not null default 0 check (wins >= 0),
  losses        int not null default 0 check (losses >= 0),
  draws         int not null default 0 check (draws >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, game_key)
);

create index if not exists game_player_ratings_leader_idx
  on public.game_player_ratings (game_key, rating desc);

alter table public.game_player_ratings enable row level security;

drop policy if exists game_player_ratings_select on public.game_player_ratings;
create policy game_player_ratings_select on public.game_player_ratings
  for select to authenticated using (true);

create table if not exists public.game_match_queue (
  id         uuid primary key default gen_random_uuid(),
  game_key   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  stake      bigint not null check (stake >= 10 and stake <= 10000),
  joined_at  timestamptz not null default now(),
  unique (game_key, user_id)
);

create index if not exists game_match_queue_lookup_idx
  on public.game_match_queue (game_key, stake, joined_at);

alter table public.game_match_queue enable row level security;

drop policy if exists game_match_queue_select on public.game_match_queue;
create policy game_match_queue_select on public.game_match_queue
  for select to authenticated using (user_id = auth.uid());

-- —— Rock Paper Scissors ——
create table if not exists public.rps_duels (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  opponent_id   uuid references auth.users(id) on delete set null,
  stake         bigint not null check (stake >= 10 and stake <= 10000),
  creator_move  text check (creator_move in ('rock', 'paper', 'scissors')),
  opponent_move text check (opponent_move in ('rock', 'paper', 'scissors')),
  status        text not null default 'open'
    check (status in ('open', 'settled', 'cancelled', 'expired')),
  winner_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '1 hour'),
  settled_at    timestamptz
);

create index if not exists rps_duels_open_idx
  on public.rps_duels (status, created_at desc) where status = 'open';

alter table public.rps_duels enable row level security;

drop policy if exists rps_duels_select on public.rps_duels;
create policy rps_duels_select on public.rps_duels
  for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or status = 'open');

-- —— High Card (1–13 draw) ——
create table if not exists public.high_card_duels (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  opponent_id   uuid references auth.users(id) on delete set null,
  stake         bigint not null check (stake >= 10 and stake <= 10000),
  creator_card  int check (creator_card between 1 and 13),
  opponent_card int check (opponent_card between 1 and 13),
  status        text not null default 'open'
    check (status in ('open', 'settled', 'cancelled', 'expired')),
  winner_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '1 hour'),
  settled_at    timestamptz
);

create index if not exists high_card_duels_open_idx
  on public.high_card_duels (status, created_at desc) where status = 'open';

alter table public.high_card_duels enable row level security;

drop policy if exists high_card_duels_select on public.high_card_duels;
create policy high_card_duels_select on public.high_card_duels
  for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or status = 'open');

create or replace function public._rps_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'rps_escrow:' || p_id::text; $$;

create or replace function public._high_card_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'high_card_escrow:' || p_id::text; $$;

create or replace function public._rps_winner(
  p_creator_move text,
  p_opponent_move text
) returns int
language plpgsql immutable as $$
begin
  if p_creator_move = p_opponent_move then return 0; end if;
  if (p_creator_move = 'rock' and p_opponent_move = 'scissors')
    or (p_creator_move = 'paper' and p_opponent_move = 'rock')
    or (p_creator_move = 'scissors' and p_opponent_move = 'paper') then
    return 1;
  end if;
  return -1;
end;
$$;

create or replace function public._apply_game_rating(
  p_game_key text,
  p_winner_id uuid,
  p_loser_id uuid,
  p_draw boolean default false
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k constant int := 32;
  v_w_rating int;
  v_l_rating int;
  v_w_expected numeric;
  v_l_expected numeric;
begin
  insert into public.game_player_ratings (user_id, game_key)
  values (p_winner_id, p_game_key)
  on conflict do nothing;
  if p_loser_id is not null then
    insert into public.game_player_ratings (user_id, game_key)
    values (p_loser_id, p_game_key)
    on conflict do nothing;
  end if;

  if p_draw then
    update public.game_player_ratings
      set games_played = games_played + 1,
          draws = draws + 1,
          updated_at = now()
    where user_id in (p_winner_id, p_loser_id) and game_key = p_game_key;
    return;
  end if;

  select rating into v_w_rating from public.game_player_ratings
   where user_id = p_winner_id and game_key = p_game_key;
  select rating into v_l_rating from public.game_player_ratings
   where user_id = p_loser_id and game_key = p_game_key;

  v_w_expected := 1.0 / (1.0 + power(10.0, (v_l_rating - v_w_rating) / 400.0));
  v_l_expected := 1.0 - v_w_expected;

  update public.game_player_ratings set
    rating = least(4000, greatest(0, rating + round(v_k * (1.0 - v_w_expected))::int)),
    games_played = games_played + 1,
    wins = wins + 1,
    updated_at = now()
  where user_id = p_winner_id and game_key = p_game_key;

  update public.game_player_ratings set
    rating = least(4000, greatest(0, rating + round(v_k * (0.0 - v_l_expected))::int)),
    games_played = games_played + 1,
    losses = losses + 1,
    updated_at = now()
  where user_id = p_loser_id and game_key = p_game_key;
end;
$$;

-- RPS RPCs
create or replace function public.create_rps_duel(
  p_stake bigint,
  p_move  text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_move not in ('rock', 'paper', 'scissors') then raise exception 'pick rock, paper, or scissors'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  insert into public.rps_duels (creator_id, stake, creator_move)
  values (v_user_id, p_stake, p_move)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'rps_duel_create', 'rps_duel:' || v_id::text,
    public._rps_escrow_code(v_id),
    jsonb_build_object('rps_duel_id', v_id)
  );

  return v_id;
end;
$$;

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

  perform public._debit_wallet_to_escrow(
    v_user_id, v_duel.stake, 'rps_duel_accept', 'rps_accept:' || p_duel_id::text,
    public._rps_escrow_code(p_duel_id),
    jsonb_build_object('rps_duel_id', p_duel_id)
  );

  v_result := public._rps_winner(v_duel.creator_move, p_move);
  if v_result = 1 then v_winner_id := v_duel.creator_id;
  elsif v_result = -1 then v_winner_id := v_user_id;
  else v_winner_id := null;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select public._wallet_for_user(v_winner_id) into v_winner_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._rps_escrow_code(p_duel_id);

  if v_winner_id is not null then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'rps_duel_settle', 'rps_settle:' || p_duel_id::text,
      jsonb_build_object('rps_duel_id', p_duel_id, 'winner_id', v_winner_id),
      v_winner_id
    ) returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

    perform public._apply_game_rating('rps', v_winner_id, v_user_id, false);
  else
    -- Draw: refund both stakes from escrow
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_draw', 'rps_draw:' || p_duel_id::text,
      jsonb_build_object('rps_duel_id', p_duel_id), v_duel.creator_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_user_id), v_duel.stake, 'vibe');

    perform public._apply_game_rating('rps', v_duel.creator_id, v_user_id, true);
  end if;

  update public.rps_duels set
    opponent_id = v_user_id,
    opponent_move = p_move,
    status = 'settled',
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;

  return query select v_duel.creator_move, p_move, v_winner_id, coalesce(v_payout, 0::bigint);
end;
$$;

create or replace function public.cancel_rps_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.rps_duels%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_duel from public.rps_duels where id = p_duel_id for update;
  if not found or v_duel.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_duel.status <> 'open' then raise exception 'not open'; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._rps_escrow_code(p_duel_id);
  select public._wallet_for_user(v_duel.creator_id) into v_wallet;

  if v_escrow is not null and v_wallet is not null then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('rps_duel_cancel', 'rps_cancel:' || p_duel_id::text,
      jsonb_build_object('rps_duel_id', p_duel_id), v_user_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_duel.stake, 'vibe'),
      (v_tx_id, v_wallet, v_duel.stake, 'vibe');
  end if;

  update public.rps_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_rps_duels(p_limit int default 20)
returns table (
  id           uuid,
  creator_id   uuid,
  creator_name text,
  stake        bigint,
  created_at   timestamptz,
  expires_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.created_at, d.expires_at
  from public.rps_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- High Card RPCs
create or replace function public.create_high_card_duel(p_stake bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  insert into public.high_card_duels (creator_id, stake)
  values (v_user_id, p_stake)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'high_card_create', 'high_card:' || v_id::text,
    public._high_card_escrow_code(v_id),
    jsonb_build_object('high_card_duel_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.accept_high_card_duel(p_duel_id uuid)
returns table (
  creator_card  int,
  opponent_card int,
  winner_id     uuid,
  payout        bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_duel          public.high_card_duels%rowtype;
  v_c_card        int;
  v_o_card        int;
  v_winner_id     uuid;
  v_pool          bigint;
  v_payout        bigint;
  v_winner_wallet uuid;
  v_mint          uuid;
  v_escrow        uuid;
  v_tx_id         uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.high_card_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel not open'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot accept your own duel'; end if;

  perform public._debit_wallet_to_escrow(
    v_user_id, v_duel.stake, 'high_card_accept', 'high_card_accept:' || p_duel_id::text,
    public._high_card_escrow_code(p_duel_id),
    jsonb_build_object('high_card_duel_id', p_duel_id)
  );

  v_c_card := floor(random() * 13 + 1)::int;
  v_o_card := floor(random() * 13 + 1)::int;

  if v_c_card > v_o_card then v_winner_id := v_duel.creator_id;
  elsif v_o_card > v_c_card then v_winner_id := v_user_id;
  else
    v_c_card := floor(random() * 13 + 1)::int;
    v_o_card := floor(random() * 13 + 1)::int;
    if v_c_card >= v_o_card then v_winner_id := v_duel.creator_id;
    else v_winner_id := v_user_id;
    end if;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select public._wallet_for_user(v_winner_id) into v_winner_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._high_card_escrow_code(p_duel_id);

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'high_card_settle', 'high_card_settle:' || p_duel_id::text,
    jsonb_build_object('high_card_duel_id', p_duel_id, 'winner_id', v_winner_id),
    v_winner_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  perform public._apply_game_rating('high_card', v_winner_id, v_user_id, false);

  update public.high_card_duels set
    opponent_id = v_user_id,
    creator_card = v_c_card,
    opponent_card = v_o_card,
    status = 'settled',
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;

  return query select v_c_card, v_o_card, v_winner_id, v_payout;
end;
$$;

create or replace function public.cancel_high_card_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.high_card_duels%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_duel from public.high_card_duels where id = p_duel_id for update;
  if not found or v_duel.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_duel.status <> 'open' then raise exception 'not open'; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._high_card_escrow_code(p_duel_id);
  select public._wallet_for_user(v_duel.creator_id) into v_wallet;

  if v_escrow is not null and v_wallet is not null then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('high_card_cancel', 'high_card_cancel:' || p_duel_id::text,
      jsonb_build_object('high_card_duel_id', p_duel_id), v_user_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_duel.stake, 'vibe'),
      (v_tx_id, v_wallet, v_duel.stake, 'vibe');
  end if;

  update public.high_card_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_high_card_duels(p_limit int default 20)
returns table (
  id           uuid,
  creator_id   uuid,
  creator_name text,
  stake        bigint,
  created_at   timestamptz,
  expires_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.created_at, d.expires_at
  from public.high_card_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public._spawn_high_card_duel(
  p_creator_id uuid,
  p_stake      bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.high_card_duels (creator_id, stake)
  values (p_creator_id, p_stake)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    p_creator_id, p_stake, 'high_card_create', 'high_card:' || v_id::text,
    public._high_card_escrow_code(v_id),
    jsonb_build_object('high_card_duel_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public._spawn_dice_duel(
  p_creator_id uuid,
  p_stake      bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.dice_duels (creator_id, stake)
  values (p_creator_id, p_stake)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    p_creator_id, p_stake, 'dice_duel_create', 'dice_duel:' || v_id::text,
    public._dice_escrow_code(v_id),
    jsonb_build_object('dice_duel_id', v_id)
  );

  return v_id;
end;
$$;

-- Matchmaking queue
create or replace function public.join_game_match_queue(
  p_game_key text,
  p_stake    bigint
) returns table (
  matched    boolean,
  duel_id    uuid,
  role       text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_other_id  uuid;
  v_duel_id   uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_game_key not in ('high_card', 'dice') then
    raise exception 'matchmaking supports high_card and dice only';
  end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  delete from public.game_match_queue
   where joined_at < now() - interval '10 minutes';

  select q.user_id into v_other_id
  from public.game_match_queue q
  where q.game_key = p_game_key and q.stake = p_stake and q.user_id <> v_user_id
  order by q.joined_at
  limit 1
  for update skip locked;

  if v_other_id is not null then
    delete from public.game_match_queue where game_key = p_game_key and user_id in (v_other_id, v_user_id);

    if p_game_key = 'high_card' then
      v_duel_id := public._spawn_high_card_duel(v_other_id, p_stake);
      return query select true, v_duel_id, 'acceptor'::text;
    else
      v_duel_id := public._spawn_dice_duel(v_other_id, p_stake);
      return query select true, v_duel_id, 'acceptor'::text;
    end if;
  end if;

  insert into public.game_match_queue (game_key, user_id, stake)
  values (p_game_key, v_user_id, p_stake)
  on conflict (game_key, user_id) do update set stake = excluded.stake, joined_at = now();

  return query select false, null::uuid, 'waiting'::text;
end;
$$;

create or replace function public.leave_game_match_queue(p_game_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.game_match_queue
   where game_key = p_game_key and user_id = auth.uid();
end;
$$;

create or replace function public.get_game_leaderboard(
  p_game_key text,
  p_limit    int default 20
)
returns table (
  user_id      uuid,
  display_name text,
  rating       int,
  wins         int,
  losses       int,
  games_played int
)
language sql stable security definer set search_path = ''
as $$
  select r.user_id,
    coalesce(p.display_name, 'Player') as display_name,
    r.rating, r.wins, r.losses, r.games_played
  from public.game_player_ratings r
  left join public.profiles p on p.id = r.user_id
  where r.game_key = p_game_key and r.games_played > 0
  order by r.rating desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.create_rps_duel(bigint, text) from public;
grant execute on function public.create_rps_duel(bigint, text) to authenticated;
revoke execute on function public.accept_rps_duel(uuid, text) from public;
grant execute on function public.accept_rps_duel(uuid, text) to authenticated;
revoke execute on function public.cancel_rps_duel(uuid) from public;
grant execute on function public.cancel_rps_duel(uuid) to authenticated;
revoke execute on function public.get_open_rps_duels(int) from public;
grant execute on function public.get_open_rps_duels(int) to authenticated;
revoke execute on function public.create_high_card_duel(bigint) from public;
grant execute on function public.create_high_card_duel(bigint) to authenticated;
revoke execute on function public.accept_high_card_duel(uuid) from public;
grant execute on function public.accept_high_card_duel(uuid) to authenticated;
revoke execute on function public.cancel_high_card_duel(uuid) from public;
grant execute on function public.cancel_high_card_duel(uuid) to authenticated;
revoke execute on function public.get_open_high_card_duels(int) from public;
grant execute on function public.get_open_high_card_duels(int) to authenticated;
revoke execute on function public.join_game_match_queue(text, bigint) from public;
grant execute on function public.join_game_match_queue(text, bigint) to authenticated;
revoke execute on function public.leave_game_match_queue(text) from public;
grant execute on function public.leave_game_match_queue(text) to authenticated;
revoke execute on function public.get_game_leaderboard(text, int) from public;
grant execute on function public.get_game_leaderboard(text, int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('game_layer_enabled', false, 'Unified duel hub at /games/duels — RPS, High Card, ratings, matchmaking')
on conflict (key) do update set description = excluded.description;
