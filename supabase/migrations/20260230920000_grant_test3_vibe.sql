-- Grant 10,000 VIBE to test account (Cool$GUY1 / test3@example.com)

do $$
declare
  v_user_id uuid;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_amount bigint := 10000;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'test3@example.com';

  if v_user_id is null then
    raise notice 'User test3@example.com not found — skip grant';
    return;
  end if;

  select id into v_wallet from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';

  if v_wallet is null then
    raise notice 'VIBE wallet missing for test3@example.com';
    return;
  end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'admin_grant',
    'admin_grant:test3:' || v_amount::text || ':' || extract(epoch from now())::bigint::text,
    jsonb_build_object('email', 'test3@example.com', 'display', 'Cool$GUY1', 'amount', v_amount),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency)
  values
    (v_tx_id, v_wallet, v_amount, 'vibe'),
    (v_tx_id, v_mint, -v_amount, 'vibe');

  raise notice 'Granted % VIBE to test3@example.com', v_amount;
end $$;
