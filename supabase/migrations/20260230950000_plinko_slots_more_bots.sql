-- Instant luck vs-bot RPCs (trivia, liar's dice, lightning).
-- Requires: 20260230970000 (escrow fix) applied first.
-- Skill-board vs-bot starters live in 20260230970100_skill_bots.sql.

-- ── Instant luck bots ──
create or replace function public.play_trivia_vs_bot(p_stake bigint default 50)
returns table (your_score int, bot_score int, winner_id uuid, payout bigint, bot_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_y int; v_b int; v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_y := floor(random() * 6)::int;
  v_b := floor(random() * 6)::int;
  if v_y > v_b then v_winner := v_user_id;
  elsif v_b > v_y then v_winner := v_bot_id;
  else v_winner := case when random() < 0.5 then v_user_id else v_bot_id end;
  end if;

  insert into public.trivia_duels (creator_id, opponent_id, stake, creator_score, opponent_score, status, winner_id, settled_at)
  values (v_user_id, v_bot_id, p_stake, v_y, v_b, 'settled', v_winner, now()) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'trivia_bot', 'trivia_bot:' || v_id::text, public._trivia_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'trivia_bot_join', 'trivia_bot_j:' || v_id::text, public._trivia_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = public._trivia_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint'::account_kind and currency = 'vibe'::currency and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('trivia_settle', 'trivia_bot_settle:' || v_id::text, jsonb_build_object('trivia_duel_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_y, v_b, v_winner, v_payout, 'Platform Bot'::text;
end; $$;

create or replace function public.play_liars_dice_vs_bot(p_stake bigint default 50)
returns table (winner_id uuid, payout bigint, bot_name text, you_won boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

  v_winner := case when random() < 0.48 then v_user_id else v_bot_id end;

  insert into public.liars_dice_games (creator_id, opponent_id, stake, status, winner_id, settled_at, is_friendly)
  values (v_user_id, v_bot_id, p_stake, 'settled', v_winner, now(), false) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'liars_bot', 'liars_bot:' || v_id::text, public._liars_dice_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'liars_bot_join', 'liars_bot_j:' || v_id::text, public._liars_dice_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = public._liars_dice_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint'::account_kind and currency = 'vibe'::currency and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('liars_dice_settle', 'liars_bot_settle:' || v_id::text, jsonb_build_object('liars_dice_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_winner, v_payout, 'Platform Bot'::text, v_winner = v_user_id;
end; $$;

create or replace function public.play_lightning_duel_vs_bot(
  p_stake bigint default 50,
  p_side text default 'up'
)
returns table (winner_id uuid, payout bigint, bot_name text, strike_price numeric, settle_price numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_bot_id uuid; v_id uuid;
  v_winner uuid; v_pool bigint; v_payout bigint;
  v_escrow uuid; v_wallet uuid; v_mint uuid; v_tx_id uuid;
  v_strike numeric := 60000 + floor(random() * 20000);
  v_settle numeric;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  if p_side not in ('up', 'down') then raise exception 'side must be up or down'; end if;
  v_bot_id := public._platform_bot_id();
  if v_bot_id is null then raise exception 'platform bot not configured'; end if;
  perform public._fund_platform_bot(greatest(p_stake * 4, 1000));

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
    v_user_id, v_bot_id, p_stake, p_side, 60,
    v_strike, v_settle, 'settled', v_winner, now(), false
  ) returning id into v_id;

  perform public._debit_wallet_to_escrow(v_user_id, p_stake, 'lightning_bot', 'lt_bot:' || v_id::text, public._lightning_escrow_code(v_id), jsonb_build_object('vs_bot', true));
  perform public._debit_wallet_to_escrow(v_bot_id, p_stake, 'lightning_bot_join', 'lt_bot_j:' || v_id::text, public._lightning_escrow_code(v_id), jsonb_build_object('vs_bot', true));

  v_pool := p_stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;
  select id into v_escrow from public.accounts where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = public._lightning_escrow_code(v_id);
  select public._wallet_for_user(v_winner) into v_wallet;
  select id into v_mint from public.accounts where kind = 'system_mint'::account_kind and currency = 'vibe'::currency and code = 'vibe_mint';
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('lightning_duel_settle', 'lt_bot_settle:' || v_id::text, jsonb_build_object('lightning_duel_id', v_id, 'vs_bot', true), v_winner)
  returning id into v_tx_id;
  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_escrow, -v_pool, 'vibe'), (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

  return query select v_winner, v_payout, 'Platform Bot'::text, v_strike, v_settle;
end; $$;

revoke all on function public.play_trivia_vs_bot(bigint) from public;
grant execute on function public.play_trivia_vs_bot(bigint) to authenticated;
revoke all on function public.play_liars_dice_vs_bot(bigint) from public;
grant execute on function public.play_liars_dice_vs_bot(bigint) to authenticated;
revoke all on function public.play_lightning_duel_vs_bot(bigint, text) from public;
grant execute on function public.play_lightning_duel_vs_bot(bigint, text) to authenticated;
