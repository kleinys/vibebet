-- Phase 41: Gem → VIBE conversion (one-way, closed loop) + fix cashout balance query

-- Fixed rate: 1 Gem = 10 VIBE (play money). Not redeemable for cash.
insert into public.feature_flags (key, enabled, description)
values
  ('gem_to_vibe_conversion_enabled', false,
   'Allow converting Gems to VIBE at 10 VIBE per Gem (one-way, closed loop)')
on conflict (key) do update set description = excluded.description;

create or replace function public.convert_gems_to_vibe(p_gems bigint)
returns table (gems_spent bigint, vibe_received bigint, transaction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_enabled       boolean := false;
  v_min_gems      bigint := 10;
  v_vibe_per_gem  bigint := 10;
  v_vibe_amount   bigint;
  v_gem_wallet    uuid;
  v_vibe_wallet   uuid;
  v_gem_burn      uuid;
  v_vibe_mint     uuid;
  v_gem_balance   bigint;
  v_tx_id         uuid;
  v_ref           text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'gem_to_vibe_conversion_enabled'),
    false
  ) into v_enabled;

  if not v_enabled then
    raise exception 'Gem → VIBE conversion is not enabled yet';
  end if;

  if p_gems is null or p_gems < v_min_gems then
    raise exception 'minimum conversion is % Gems', v_min_gems;
  end if;

  if p_gems > 100000 then
    raise exception 'maximum conversion per request is 100,000 Gems';
  end if;

  v_vibe_amount := p_gems * v_vibe_per_gem;

  select id into v_gem_wallet from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'gem';

  select id into v_vibe_wallet from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';

  if v_gem_wallet is null or v_vibe_wallet is null then
    raise exception 'wallet accounts not found';
  end if;

  select coalesce(sum(amount), 0) into v_gem_balance
  from public.ledger_entries where account_id = v_gem_wallet;

  if p_gems > v_gem_balance then
    raise exception 'insufficient Gems: have %, need %', v_gem_balance, p_gems;
  end if;

  select id into v_gem_burn from public.accounts
  where kind = 'system_burn' and currency = 'gem' and code = 'gem_spend_burn';

  if v_gem_burn is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'gem', 'gem_spend_burn')
    returning id into v_gem_burn;
  end if;

  select id into v_vibe_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  if v_vibe_mint is null then
    insert into public.accounts (kind, currency, code)
    values ('system_mint', 'vibe', 'vibe_mint')
    returning id into v_vibe_mint;
  end if;

  v_ref := 'gem_to_vibe:' || v_user_id::text || ':' || gen_random_uuid()::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'gem_to_vibe',
    v_ref,
    jsonb_build_object(
      'gems_spent', p_gems,
      'vibe_received', v_vibe_amount,
      'rate_vibe_per_gem', v_vibe_per_gem
    ),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_gem_wallet, -p_gems, 'gem'),
    (v_tx_id, v_gem_burn, p_gems, 'gem'),
    (v_tx_id, v_vibe_wallet, v_vibe_amount, 'vibe'),
    (v_tx_id, v_vibe_mint, -v_vibe_amount, 'vibe');

  return query select p_gems, v_vibe_amount, v_tx_id;
end;
$$;

revoke execute on function public.convert_gems_to_vibe(bigint) from public;
grant execute on function public.convert_gems_to_vibe(bigint) to authenticated;

-- Fix phase 39 balance lookup (accounts use owner_user_id, not user_id)
create or replace function public.request_gem_withdrawal(
  p_gems bigint,
  p_method text default 'paypal'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_enabled boolean := false;
  v_balance bigint;
  v_min     bigint := 500;
  v_usd     bigint;
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'gems_cashout_enabled'),
    false
  ) into v_enabled;

  if not v_enabled then
    raise exception 'Gem cashout is not available yet — play-money only for now';
  end if;

  if p_gems < v_min then
    raise exception 'minimum withdrawal is % Gems', v_min;
  end if;

  select coalesce(
    (select sum(le.amount) from public.ledger_entries le
     join public.accounts a on a.id = le.account_id
     where a.owner_user_id = v_user_id and a.currency = 'gem' and a.kind = 'user_wallet'),
    0
  ) into v_balance;

  if p_gems > v_balance then raise exception 'insufficient Gems'; end if;

  v_usd := (p_gems * 100) / 100;

  insert into public.withdrawal_requests (user_id, gems_amount, usd_cents, method, status)
  values (v_user_id, p_gems, v_usd, p_method, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;
