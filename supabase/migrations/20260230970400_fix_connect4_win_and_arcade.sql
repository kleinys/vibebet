-- Fix Connect Four instant-win bug (direction 2 was 0,0 — counted same cell 4×).
-- Bootstrap arcade RPCs/tables if missing on partial DBs. Enable poker flag.

create or replace function public._connect4_check_win(p_board int[], p_player int)
returns boolean
language plpgsql
immutable
as $$
declare
  r int;
  c int;
  dr int[] := array[0, 1, 1, 1];
  dc int[] := array[1, 0, 1, -1];
  i int;
  cnt int;
  nr int;
  nc int;
  step int;
begin
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

-- ── dice_duels + coin flip (arcade vs-bot) ────────────────────────────────────
create table if not exists public.dice_duels (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
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
  using (creator_id = auth.uid() or opponent_id = auth.uid() or status = 'open');

create or replace function public._dice_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'dice_escrow:' || p_id::text; $$;

create or replace function public.play_coin_flip(
  p_side  text,
  p_stake bigint
) returns table (won boolean, payout bigint, flip_side text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_balance bigint;
  v_flip text;
  v_won boolean;
  v_payout bigint;
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

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
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

revoke all on function public.play_coin_flip(text, bigint) from public;
grant execute on function public.play_coin_flip(text, bigint) to authenticated;

-- Poker pages 404 when flag off but bot match exists — enable poker.
insert into public.feature_flags (key, enabled, description)
values ('poker_enabled', true, 'Heads-up hold''em showdown at /games/duels/poker')
on conflict (key) do update set enabled = true;
