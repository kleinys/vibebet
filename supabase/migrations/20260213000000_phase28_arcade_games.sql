-- =============================================================================
-- Phase 28: Arcade mini-games — Coin Flip + Dice Duel
-- =============================================================================

-- Fix escrow helper so second player can join same pool (accept flows).
create or replace function public._debit_wallet_to_escrow(
  p_user_id    uuid,
  p_amount     bigint,
  p_kind       text,
  p_external   text,
  p_escrow_code text,
  p_metadata   jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet uuid;
  v_escrow uuid;
  v_balance bigint;
  v_tx_id  uuid;
begin
  select public._wallet_for_user(p_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_amount then
    raise exception 'insufficient VIBE: need %, have %', p_amount, v_balance;
  end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = p_escrow_code;

  if v_escrow is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'vibe', p_escrow_code)
    returning id into v_escrow;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (p_kind, p_external, p_metadata, p_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_amount, 'vibe'),
    (v_tx_id, v_escrow,  p_amount, 'vibe');

  return v_tx_id;
end;
$$;

create table if not exists public.dice_duels (
  id            uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references auth.users(id) on delete cascade,
  opponent_id   uuid references auth.users(id) on delete set null,
  stake         bigint not null check (stake >= 10 and stake <= 10000),
  status        text not null default 'open'
    check (status in ('open', 'settled', 'cancelled', 'expired')),
  creator_roll  int check (creator_roll between 2 and 12),
  opponent_roll int check (opponent_roll between 2 and 12),
  winner_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '1 hour'),
  settled_at    timestamptz
);

create index if not exists dice_duels_open_idx
  on public.dice_duels (status, created_at desc)
  where status = 'open';

alter table public.dice_duels enable row level security;

drop policy if exists dice_duels_select on public.dice_duels;
create policy dice_duels_select on public.dice_duels
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or status = 'open'
  );

create or replace function public._dice_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'dice_escrow:' || p_id::text; $$;

-- Coin flip vs house. Win = 1.8× stake (10% house edge).
create or replace function public.play_coin_flip(
  p_side  text,
  p_stake bigint
) returns table (
  won       boolean,
  payout    bigint,
  flip_side text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_wallet    uuid;
  v_mint      uuid;
  v_tx_id     uuid;
  v_balance   bigint;
  v_flip      text;
  v_won       boolean;
  v_payout    bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_side not in ('heads', 'tails') then raise exception 'pick heads or tails'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then
    raise exception 'insufficient VIBE: need %, have %', p_stake, v_balance;
  end if;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  v_flip := case when random() < 0.5 then 'heads' else 'tails' end;
  v_won := v_flip = p_side;
  v_payout := case when v_won then floor(p_stake * 1.8)::bigint else 0 end;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'coin_flip',
    'coin_flip:' || gen_random_uuid()::text,
    jsonb_build_object('side', p_side, 'flip', v_flip, 'stake', p_stake, 'won', v_won),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe');

  if v_won then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, -(v_payout - p_stake), 'vibe');
  else
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_mint, p_stake, 'vibe');
  end if;

  return query select v_won, v_payout, v_flip;
end;
$$;

create or replace function public.create_dice_duel(p_stake bigint)
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

  insert into public.dice_duels (creator_id, stake)
  values (v_user_id, p_stake)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'dice_duel_create', 'dice_duel:' || v_id::text,
    public._dice_escrow_code(v_id),
    jsonb_build_object('dice_duel_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.accept_dice_duel(p_duel_id uuid)
returns table (
  creator_roll  int,
  opponent_roll int,
  winner_id     uuid,
  payout        bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_duel         public.dice_duels%rowtype;
  v_c_roll       int;
  v_o_roll       int;
  v_winner_id    uuid;
  v_pool         bigint;
  v_payout       bigint;
  v_winner_wallet uuid;
  v_mint         uuid;
  v_escrow        uuid;
  v_tx_id        uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.dice_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel not open'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot accept your own duel'; end if;

  perform public._debit_wallet_to_escrow(
    v_user_id, v_duel.stake, 'dice_duel_accept', 'dice_accept:' || p_duel_id::text,
    public._dice_escrow_code(p_duel_id),
    jsonb_build_object('dice_duel_id', p_duel_id)
  );

  v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
  v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;

  if v_c_roll > v_o_roll then v_winner_id := v_duel.creator_id;
  elsif v_o_roll > v_c_roll then v_winner_id := v_user_id;
  else
    v_c_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    v_o_roll := floor(random() * 6 + 1)::int + floor(random() * 6 + 1)::int;
    if v_c_roll >= v_o_roll then v_winner_id := v_duel.creator_id;
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
     and code = public._dice_escrow_code(p_duel_id);

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'dice_duel_settle',
    'dice_duel_settle:' || p_duel_id::text,
    jsonb_build_object(
      'dice_duel_id', p_duel_id,
      'creator_roll', v_c_roll,
      'opponent_roll', v_o_roll,
      'winner_id', v_winner_id
    ),
    v_winner_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'),
    (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
    (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  update public.dice_duels set
    opponent_id = v_user_id,
    status = 'settled',
    creator_roll = v_c_roll,
    opponent_roll = v_o_roll,
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;

  return query select v_c_roll, v_o_roll, v_winner_id, v_payout;
end;
$$;

create or replace function public.cancel_dice_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel   public.dice_duels%rowtype;
  v_escrow  uuid;
  v_wallet uuid;
  v_tx_id  uuid;
begin
  select * into v_duel from public.dice_duels where id = p_duel_id for update;
  if not found or v_duel.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_duel.status <> 'open' then raise exception 'not open'; end if;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._dice_escrow_code(p_duel_id);
  select public._wallet_for_user(v_duel.creator_id) into v_wallet;

  if v_escrow is not null and v_wallet is not null then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('dice_duel_cancel', 'dice_cancel:' || p_duel_id::text,
      jsonb_build_object('dice_duel_id', p_duel_id), v_user_id)
    returning id into v_tx_id;
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_duel.stake, 'vibe'),
      (v_tx_id, v_wallet, v_duel.stake, 'vibe');
  end if;

  update public.dice_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_dice_duels(p_limit int default 20)
returns table (
  id          uuid,
  creator_id  uuid,
  creator_name text,
  stake       bigint,
  created_at  timestamptz,
  expires_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    d.id,
    d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake,
    d.created_at,
    d.expires_at
  from public.dice_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.play_coin_flip(text, bigint) from public;
grant execute on function public.play_coin_flip(text, bigint) to authenticated;
revoke execute on function public.create_dice_duel(bigint) from public;
grant execute on function public.create_dice_duel(bigint) to authenticated;
revoke execute on function public.accept_dice_duel(uuid) from public;
grant execute on function public.accept_dice_duel(uuid) to authenticated;
revoke execute on function public.cancel_dice_duel(uuid) from public;
grant execute on function public.cancel_dice_duel(uuid) to authenticated;
revoke execute on function public.get_open_dice_duels(int) from public;
      grant execute on function public.get_open_dice_duels(int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('arcade_games_enabled', false, 'Coin Flip + Dice Duel at /games/arcade')
on conflict (key) do update set description = excluded.description;