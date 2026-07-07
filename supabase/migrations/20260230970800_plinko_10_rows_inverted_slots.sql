-- Plinko: 10-row / 11-slot board with inverted multipliers (high edges, 0.1 center on medium).

create or replace function public.play_plinko(p_stake bigint, p_risk text default 'medium')
returns table (slot_index int, multiplier numeric, payout bigint, net bigint, new_balance bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_wallet uuid; v_mint uuid; v_burn uuid; v_tx_id uuid;
  v_balance bigint; v_mult numeric; v_payout bigint; v_net bigint;
  v_slots numeric[]; v_weights numeric[]; v_total numeric := 0; v_pick numeric; v_i int; v_idx int := 1;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 5000 then raise exception 'stake must be 10–5,000 VIBE'; end if;
  if p_risk not in ('low', 'medium', 'high') then raise exception 'risk must be low, medium, or high'; end if;

  if p_risk = 'low' then
    v_weights := array[6, 8, 10, 12, 14, 18, 14, 12, 10, 8, 6];
    v_slots := array[3, 2, 1.5, 1.2, 1, 0.5, 1, 1.2, 1.5, 2, 3];
  elsif p_risk = 'high' then
    v_weights := array[4, 6, 8, 10, 14, 24, 14, 10, 8, 6, 4];
    v_slots := array[10, 5, 3, 2, 0.5, 0.1, 0.5, 2, 3, 5, 10];
  else
    v_weights := array[4, 6, 8, 10, 14, 26, 14, 10, 8, 6, 4];
    v_slots := array[5, 3, 2, 1.5, 1, 0.1, 1, 1.5, 2, 3, 5];
  end if;

  for v_i in 1..array_length(v_weights, 1) loop v_total := v_total + v_weights[v_i]; end loop;
  v_pick := random() * v_total; v_total := 0;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then v_idx := v_i; exit; end if;
  end loop;
  v_mult := v_slots[v_idx]; v_payout := floor(p_stake * v_mult)::bigint; v_net := v_payout - p_stake;

  select public._wallet_for_user(v_user_id) into v_wallet;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  if v_balance < p_stake then raise exception 'insufficient VIBE'; end if;

  v_mint := public._ensure_system_account('system_mint', 'vibe', 'vibe_mint');
  v_burn := public._ensure_system_account('system_burn', 'vibe', 'plinko_burn');

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values ('plinko', 'plinko:' || gen_random_uuid()::text,
    jsonb_build_object('stake', p_stake, 'risk', p_risk, 'slot', v_idx, 'multiplier', v_mult, 'payout', v_payout), v_user_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'), (v_tx_id, v_burn, p_stake, 'vibe');
  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'), (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where account_id = v_wallet;
  return query select v_idx - 1, v_mult, v_payout, v_net, v_balance;
end; $$;

revoke all on function public.play_plinko(bigint, text) from public;
grant execute on function public.play_plinko(bigint, text) to authenticated;
