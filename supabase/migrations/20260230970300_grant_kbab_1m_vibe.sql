-- Grant 1,000,000 VIBE to kbab (username or email match)

do $$
declare
  v_user_id uuid;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_amount bigint := 1000000;
  v_ref text;
begin
  select u.id into v_user_id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(p.username, '')) = 'kbab'
     or lower(u.email) like '%kbab%'
  order by u.created_at
  limit 1;

  if v_user_id is null then
    raise notice 'kbab account not found — skip grant';
    return;
  end if;

  v_ref := 'admin_grant:kbab:1m:' || extract(epoch from now())::bigint::text;

  select id into v_wallet from public.accounts
  where owner_user_id = v_user_id
    and kind = 'user_wallet'::account_kind
    and currency = 'vibe'::currency;

  if v_wallet is null then
    raise notice 'VIBE wallet missing for kbab';
    return;
  end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint'::account_kind
    and currency = 'vibe'::currency
    and code = 'vibe_mint';

  if v_mint is null then
    raise notice 'vibe_mint account missing';
    return;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'admin_grant',
    v_ref,
    jsonb_build_object('username', 'kbab', 'amount', v_amount),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency)
  values
    (v_tx_id, v_wallet, v_amount, 'vibe'),
    (v_tx_id, v_mint, -v_amount, 'vibe');

  raise notice 'Granted % VIBE to kbab', v_amount;
end $$;
