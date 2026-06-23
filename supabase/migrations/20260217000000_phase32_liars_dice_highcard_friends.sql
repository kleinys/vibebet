-- =============================================================================
-- Phase 32: Liar's Dice + High Card friend invites / friendly zero-stake
-- =============================================================================

alter table public.high_card_duels drop constraint if exists high_card_duels_stake_check;
alter table public.high_card_duels add constraint high_card_duels_stake_check check (
  (is_friendly and stake = 0)
  or (not is_friendly and stake >= 10 and stake <= 10000)
);

create or replace function public._liars_dice_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'liars_dice_escrow:' || p_id::text; $$;

create or replace function public._roll_five_dice()
returns int[]
language sql volatile as $$
  select array[
    floor(random() * 6 + 1)::int,
    floor(random() * 6 + 1)::int,
    floor(random() * 6 + 1)::int,
    floor(random() * 6 + 1)::int,
    floor(random() * 6 + 1)::int
  ];
$$;

create or replace function public._liars_dice_count_face(
  p_creator_dice int[],
  p_opponent_dice int[],
  p_face int
) returns int
language sql immutable as $$
  select coalesce((
    select count(*)::int from unnest(p_creator_dice || p_opponent_dice) d
    where d = p_face or d = 1
  ), 0);
$$;

create or replace function public._liars_dice_bid_valid(
  p_old_q int,
  p_old_f int,
  p_new_q int,
  p_new_f int
) returns boolean
language plpgsql immutable as $$
begin
  if p_new_q < 1 or p_new_q > 10 or p_new_f < 1 or p_new_f > 6 then return false; end if;
  if p_old_q is null or p_old_q = 0 then return true; end if;
  if p_new_q > p_old_q then return true; end if;
  if p_new_q = p_old_q and p_new_f > p_old_f then return true; end if;
  return false;
end;
$$;

create table if not exists public.liars_dice_games (
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
  creator_dice     int[] check (creator_dice is null or array_length(creator_dice, 1) = 5),
  opponent_dice    int[] check (opponent_dice is null or array_length(opponent_dice, 1) = 5),
  bid_quantity     int check (bid_quantity is null or (bid_quantity >= 1 and bid_quantity <= 10)),
  bid_face         int check (bid_face is null or (bid_face >= 1 and bid_face <= 6)),
  last_bidder_id   uuid references auth.users(id) on delete set null,
  current_turn_id  uuid references auth.users(id) on delete set null,
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled')),
  winner_id        uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  settled_at       timestamptz
);

create index if not exists liars_dice_games_open_idx
  on public.liars_dice_games (status, created_at desc) where status = 'open';

alter table public.liars_dice_games enable row level security;

drop policy if exists liars_dice_games_select on public.liars_dice_games;
create policy liars_dice_games_select on public.liars_dice_games
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or invited_user_id = auth.uid()
    or (status = 'open' and invited_user_id is null)
  );

create or replace function public.create_liars_dice_game(
  p_stake       bigint,
  p_invite_code text default null,
  p_friendly    boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_invited  uuid;
  v_id       uuid;
  v_friendly boolean := coalesce(p_friendly, false);
  v_stake    bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.liars_dice_games (creator_id, stake, invited_user_id, is_friendly)
  values (v_user_id, v_stake, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'liars_dice_create', 'liars_dice:' || v_id::text,
      public._liars_dice_escrow_code(v_id),
      jsonb_build_object('liars_dice_id', v_id)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.accept_liars_dice_game(p_game_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.liars_dice_games%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_game from public.liars_dice_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game not open'; end if;
  if v_game.creator_id = v_user_id then raise exception 'cannot join your own game'; end if;
  if v_game.invited_user_id is not null and v_game.invited_user_id <> v_user_id then
    raise exception 'this game is reserved for another player';
  end if;

  if v_game.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_game.stake, 'liars_dice_accept', 'liars_dice_accept:' || p_game_id::text,
      public._liars_dice_escrow_code(p_game_id),
      jsonb_build_object('liars_dice_id', p_game_id)
    );
  end if;

  update public.liars_dice_games set
    opponent_id = v_user_id,
    creator_dice = public._roll_five_dice(),
    opponent_dice = public._roll_five_dice(),
    status = 'active',
    current_turn_id = creator_id
  where id = p_game_id;
end;
$$;

create or replace function public.place_liars_dice_bid(
  p_game_id uuid,
  p_quantity int,
  p_face int
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.liars_dice_games%rowtype;
  v_next    uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_game from public.liars_dice_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;

  if not public._liars_dice_bid_valid(v_game.bid_quantity, v_game.bid_face, p_quantity, p_face) then
    raise exception 'bid must raise quantity or face (1s are wild)';
  end if;

  v_next := case when v_user_id = v_game.creator_id then v_game.opponent_id else v_game.creator_id end;

  update public.liars_dice_games set
    bid_quantity = p_quantity,
    bid_face = p_face,
    last_bidder_id = v_user_id,
    current_turn_id = v_next
  where id = p_game_id;
end;
$$;

create or replace function public._liars_dice_settle(
  p_game_id uuid,
  p_caller_id uuid,
  p_bidder_wins boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_game          public.liars_dice_games%rowtype;
  v_winner        uuid;
  v_loser         uuid;
  v_pool          bigint;
  v_payout        bigint;
  v_escrow        uuid;
  v_wallet        uuid;
  v_mint          uuid;
  v_tx_id         uuid;
begin
  select * into v_game from public.liars_dice_games where id = p_game_id;

  if p_bidder_wins then
    v_winner := v_game.last_bidder_id;
    v_loser := p_caller_id;
  else
    v_winner := p_caller_id;
    v_loser := v_game.last_bidder_id;
  end if;

  if v_game.stake > 0 then
    v_pool := v_game.stake * 2;
    v_payout := floor(v_pool * 0.9)::bigint;
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._liars_dice_escrow_code(p_game_id);
    select public._wallet_for_user(v_winner) into v_wallet;
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('liars_dice_settle', 'liars_dice_settle:' || p_game_id::text,
      jsonb_build_object('liars_dice_id', p_game_id, 'winner_id', v_winner), v_winner)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
  end if;

  if not v_game.is_friendly then
    perform public._apply_game_rating('liars_dice', v_winner, v_loser, false);
  end if;

  update public.liars_dice_games set
    status = 'settled',
    winner_id = v_winner,
    current_turn_id = null,
    settled_at = now()
  where id = p_game_id;
end;
$$;

create or replace function public.call_liars_dice(p_game_id uuid)
returns table (
  winner_id uuid,
  actual_count int,
  bid_quantity int,
  bid_face int
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.liars_dice_games%rowtype;
  v_count   int;
  v_bidder_wins boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_game from public.liars_dice_games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game not active'; end if;
  if v_game.current_turn_id <> v_user_id then raise exception 'not your turn'; end if;
  if v_game.bid_quantity is null then raise exception 'no bid to challenge yet'; end if;
  if v_game.last_bidder_id = v_user_id then raise exception 'cannot call liar on your own bid'; end if;

  v_count := public._liars_dice_count_face(v_game.creator_dice, v_game.opponent_dice, v_game.bid_face);
  v_bidder_wins := v_count >= v_game.bid_quantity;

  perform public._liars_dice_settle(p_game_id, v_user_id, v_bidder_wins);

  return query select
    case when v_bidder_wins then v_game.last_bidder_id else v_user_id end,
    v_count,
    v_game.bid_quantity,
    v_game.bid_face;
end;
$$;

create or replace function public.cancel_liars_dice_game(p_game_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.liars_dice_games%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_game from public.liars_dice_games where id = p_game_id for update;
  if not found or v_game.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_game.status <> 'open' then raise exception 'not open'; end if;

  if v_game.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._liars_dice_escrow_code(p_game_id);
    select public._wallet_for_user(v_game.creator_id) into v_wallet;

    if v_escrow is not null and v_wallet is not null then
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('liars_dice_cancel', 'liars_dice_cancel:' || p_game_id::text,
        jsonb_build_object('liars_dice_id', p_game_id), v_user_id)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_game.stake, 'vibe'),
        (v_tx_id, v_wallet, v_game.stake, 'vibe');
    end if;
  end if;

  update public.liars_dice_games set status = 'cancelled' where id = p_game_id;
end;
$$;

create or replace function public.get_open_liars_dice_games(p_limit int default 20)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  stake           bigint,
  is_friendly     boolean,
  invited_user_id uuid,
  created_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    g.stake, g.is_friendly, g.invited_user_id, g.created_at
  from public.liars_dice_games g
  left join public.profiles p on p.id = g.creator_id
  where g.status = 'open' and g.expires_at > now()
    and (g.invited_user_id is null or g.invited_user_id = auth.uid())
  order by g.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.get_liars_dice_game(p_game_id uuid)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  opponent_id     uuid,
  opponent_name   text,
  invited_user_id uuid,
  stake           bigint,
  is_friendly     boolean,
  my_dice         int[],
  creator_dice    int[],
  opponent_dice   int[],
  bid_quantity    int,
  bid_face        int,
  last_bidder_id  uuid,
  current_turn_id uuid,
  status          text,
  winner_id       uuid,
  settled_at      timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.liars_dice_games%rowtype;
begin
  select * into v_game from public.liars_dice_games where id = p_game_id;
  if not found then return; end if;

  return query select
    v_game.id, v_game.creator_id,
    coalesce((select display_name from public.profiles where id = v_game.creator_id), 'Player'),
    v_game.opponent_id,
    coalesce((select display_name from public.profiles where id = v_game.opponent_id), 'Player'),
    v_game.invited_user_id, v_game.stake, v_game.is_friendly,
    case
      when v_user_id = v_game.creator_id then v_game.creator_dice
      when v_user_id = v_game.opponent_id then v_game.opponent_dice
      else null::int[]
    end,
    case when v_game.status = 'settled' then v_game.creator_dice else null end,
    case when v_game.status = 'settled' then v_game.opponent_dice else null end,
    v_game.bid_quantity, v_game.bid_face, v_game.last_bidder_id,
    v_game.current_turn_id, v_game.status, v_game.winner_id, v_game.settled_at;
end;
$$;

-- High Card: friend invites + friendly zero-stake
drop function if exists public.get_open_high_card_duels(int);
drop function if exists public.create_high_card_duel(bigint);

create or replace function public.create_high_card_duel(
  p_stake       bigint,
  p_invite_code text default null,
  p_friendly    boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_invited  uuid;
  v_id       uuid;
  v_friendly boolean := coalesce(p_friendly, false);
  v_stake    bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.high_card_duels (creator_id, stake, invited_user_id, is_friendly)
  values (v_user_id, v_stake, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'high_card_create', 'high_card:' || v_id::text,
      public._high_card_escrow_code(v_id),
      jsonb_build_object('high_card_duel_id', v_id)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.get_open_high_card_duels(p_limit int default 20)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  stake           bigint,
  is_friendly     boolean,
  invited_user_id uuid,
  created_at      timestamptz,
  expires_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.is_friendly, d.invited_user_id, d.created_at, d.expires_at
  from public.high_card_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
    and (d.invited_user_id is null or d.invited_user_id = auth.uid())
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- Patch accept_high_card for invite check + friendly stake + rating skip
create or replace function public.accept_high_card_duel(p_duel_id uuid)
returns table (
  creator_card  int,
  opponent_card int,
  winner_id     uuid,
  payout        bigint
)
language plpgsql security definer set search_path = ''
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
  if v_duel.invited_user_id is not null and v_duel.invited_user_id <> v_user_id then
    raise exception 'this duel is reserved for another player';
  end if;

  if v_duel.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_duel.stake, 'high_card_accept', 'high_card_accept:' || p_duel_id::text,
      public._high_card_escrow_code(p_duel_id),
      jsonb_build_object('high_card_duel_id', p_duel_id)
    );
  end if;

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

  if v_duel.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._high_card_escrow_code(p_duel_id);

    select public._wallet_for_user(v_winner_id) into v_winner_wallet;
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('high_card_settle', 'high_card_settle:' || p_duel_id::text,
      jsonb_build_object('high_card_duel_id', p_duel_id, 'winner_id', v_winner_id), v_winner_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
  end if;

  if not v_duel.is_friendly then
    perform public._apply_game_rating('high_card', v_winner_id, v_user_id, false);
  end if;

  update public.high_card_duels set
    opponent_id = v_user_id,
    creator_card = v_c_card,
    opponent_card = v_o_card,
    status = 'settled',
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;

  return query select v_c_card, v_o_card, v_winner_id, coalesce(v_payout, 0::bigint);
end;
$$;

revoke execute on function public.create_liars_dice_game(bigint, text, boolean) from public;
grant execute on function public.create_liars_dice_game(bigint, text, boolean) to authenticated;
revoke execute on function public.accept_liars_dice_game(uuid) from public;
grant execute on function public.accept_liars_dice_game(uuid) to authenticated;
revoke execute on function public.place_liars_dice_bid(uuid, int, int) from public;
grant execute on function public.place_liars_dice_bid(uuid, int, int) to authenticated;
revoke execute on function public.call_liars_dice(uuid) from public;
grant execute on function public.call_liars_dice(uuid) to authenticated;
revoke execute on function public.cancel_liars_dice_game(uuid) from public;
grant execute on function public.cancel_liars_dice_game(uuid) to authenticated;
revoke execute on function public.get_open_liars_dice_games(int) from public;
grant execute on function public.get_open_liars_dice_games(int) to authenticated;
revoke execute on function public.get_liars_dice_game(uuid) from public;
grant execute on function public.get_liars_dice_game(uuid) to authenticated;
revoke execute on function public.create_high_card_duel(bigint, text, boolean) from public;
grant execute on function public.create_high_card_duel(bigint, text, boolean) to authenticated;
revoke execute on function public.get_open_high_card_duels(int) from public;
grant execute on function public.get_open_high_card_duels(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('liars_dice_enabled', false, 'Liar''s Dice bluff duels at /games/duels/liars-dice')
on conflict (key) do update set description = excluded.description;
