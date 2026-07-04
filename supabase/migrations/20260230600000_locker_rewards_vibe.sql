-- Locker rewards: VIBE stakes + payouts, restrict cosmetic grants to allowlisted accounts.

-- ── Revoke mass cosmetic grant from everyone except test3 + kbab ───────────────
delete from public.user_inventory ui
using public.shop_items si
where ui.item_id = si.id
  and si.kind in ('skin', 'badge')
  and ui.user_id not in (
    select u.id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(u.email) = 'test3@example.com'
       or lower(coalesce(p.username, '')) = 'kbab'
       or lower(u.email) like '%kbab%'
       or lower(replace(coalesce(p.display_name, ''), ' ', '')) = 'cool$guy1'
  );

-- Grant full locker pack to allowlisted users only.
insert into public.user_inventory (user_id, item_id)
select u.id, si.id
from auth.users u
cross join public.shop_items si
left join public.profiles p on p.id = u.id
where si.kind in ('skin', 'badge')
  and si.slug <> 'founder-badge'
  and (
    lower(u.email) = 'test3@example.com'
    or lower(coalesce(p.username, '')) = 'kbab'
    or lower(u.email) like '%kbab%'
    or lower(replace(coalesce(p.display_name, ''), ' ', '')) = 'cool$guy1'
  )
on conflict (user_id, item_id) do nothing;

-- ── Allowlist-only locker pack RPC ───────────────────────────────────────────
create or replace function public.grant_locker_cosmetics()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = v_uid
      and (
        lower(u.email) = 'test3@example.com'
        or lower(coalesce(p.username, '')) = 'kbab'
        or lower(u.email) like '%kbab%'
        or lower(replace(coalesce(p.display_name, ''), ' ', '')) = 'cool$guy1'
      )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Locker pack unlock is not available for this account';
  end if;

  insert into public.user_inventory (user_id, item_id)
  select v_uid, si.id
  from public.shop_items si
  where si.kind in ('skin', 'badge')
    and si.slug <> 'founder-badge'
  on conflict (user_id, item_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.grant_locker_cosmetics() from public;
grant execute on function public.grant_locker_cosmetics() to authenticated;

-- ── Bonus VIBE for kbab (if account exists) ──────────────────────────────────
do $$
declare
  v_uid uuid;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_ref text;
begin
  select u.id into v_uid
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(p.username, '')) = 'kbab'
     or lower(u.email) like '%kbab%'
  order by u.created_at
  limit 1;

  if v_uid is null then
    raise notice 'kbab account not found — skipping 9000 VIBE bonus';
    return;
  end if;

  v_ref := 'admin_bonus:kbab:9000vibe';

  if exists (select 1 from public.ledger_transactions where external_ref = v_ref) then
    raise notice 'kbab VIBE bonus already posted';
    return;
  end if;

  select public._wallet_for_user(v_uid) into v_wallet;
  if v_wallet is null then raise exception 'kbab wallet missing'; end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'vibe mint missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'admin_bonus',
    v_ref,
    jsonb_build_object('reason', 'kbab starter bonus', 'amount', 9000),
    v_uid
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, 9000, 'vibe'),
    (v_tx_id, v_mint, -9000, 'vibe');
end;
$$;

-- ── Daily wheel spin tracker ─────────────────────────────────────────────────
create table if not exists public.locker_wheel_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_date date not null default (timezone('utc', now()))::date,
  spins_used int not null default 0 check (spins_used >= 0),
  primary key (user_id, spin_date)
);

alter table public.locker_wheel_daily enable row level security;

drop policy if exists locker_wheel_daily_select on public.locker_wheel_daily;
create policy locker_wheel_daily_select on public.locker_wheel_daily
  for select to authenticated using (user_id = auth.uid());

-- ── Mystery crate: pay VIBE stake, receive weighted VIBE payout ──────────────
create or replace function public.open_locker_crate(p_stake bigint default 250)
returns table (
  label text,
  payout bigint,
  net bigint,
  new_balance bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet uuid;
  v_mint uuid;
  v_burn uuid;
  v_tx_id uuid;
  v_balance bigint;
  v_roll numeric;
  v_payout bigint;
  v_label text;
  v_ref text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 50 or p_stake > 5000 then
    raise exception 'crate stake must be 50–5,000 VIBE';
  end if;

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

  select id into v_burn from public.accounts
  where kind = 'system_burn' and currency = 'vibe' and code = 'locker_crate_burn';
  if v_burn is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'vibe', 'locker_crate_burn')
    returning id into v_burn;
  end if;

  v_roll := random();
  if v_roll < 0.40 then
    v_payout := (p_stake * (0.15 + random() * 0.35))::bigint;
    v_label := 'Common drop';
  elsif v_roll < 0.75 then
    v_payout := (p_stake * (0.85 + random() * 0.45))::bigint;
    v_label := 'Uncommon drop';
  elsif v_roll < 0.93 then
    v_payout := (p_stake * (1.4 + random() * 0.9))::bigint;
    v_label := 'Rare drop';
  elsif v_roll < 0.99 then
    v_payout := (p_stake * (2.5 + random() * 1.5))::bigint;
    v_label := 'Epic drop';
  else
    v_payout := (p_stake * (5 + random() * 4))::bigint;
    v_label := 'Legendary jackpot';
  end if;

  v_payout := greatest(10, v_payout);
  v_ref := 'locker_crate:' || gen_random_uuid()::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'locker_crate',
    v_ref,
    jsonb_build_object('stake', p_stake, 'payout', v_payout, 'label', v_label),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_wallet, -p_stake, 'vibe'),
    (v_tx_id, v_burn, p_stake, 'vibe');

  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;

  return query select v_label, v_payout, v_payout - p_stake, v_balance;
end;
$$;

revoke all on function public.open_locker_crate(bigint) from public;
grant execute on function public.open_locker_crate(bigint) to authenticated;

-- ── Spin wheel: first spin free daily, then 100 VIBE; weighted VIBE payout ───
create or replace function public.spin_locker_wheel(p_paid_stake bigint default 100)
returns table (
  segment_index int,
  label text,
  payout bigint,
  cost bigint,
  net bigint,
  new_balance bigint,
  free_spin boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet uuid;
  v_mint uuid;
  v_burn uuid;
  v_tx_id uuid;
  v_balance bigint;
  v_cost bigint := 0;
  v_free boolean := false;
  v_spins int := 0;
  v_today date := (timezone('utc', now()))::date;
  v_roll numeric;
  v_idx int;
  v_payout bigint;
  v_label text;
  v_ref text;
  v_segments text[] := array[
    '25 VIBE', '100 VIBE', '50 VIBE', '500 VIBE', '10 VIBE', '250 VIBE',
    '75 VIBE', '1000 VIBE', '15 VIBE', '200 VIBE', '30 VIBE', '2500 JACKPOT'
  ];
  v_payouts bigint[] := array[25, 100, 50, 500, 10, 250, 75, 1000, 15, 200, 30, 2500];
  v_weights numeric[] := array[14, 8, 12, 3, 16, 6, 10, 2, 15, 7, 13, 1];
  v_total numeric := 0;
  v_pick numeric;
  v_i int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_paid_stake < 50 or p_paid_stake > 2000 then
    raise exception 'paid spin stake must be 50–2,000 VIBE';
  end if;

  select coalesce(spins_used, 0) into v_spins
  from public.locker_wheel_daily
  where user_id = v_user_id and spin_date = v_today;

  if v_spins is null then v_spins := 0; end if;

  if v_spins = 0 then
    v_free := true;
    v_cost := 0;
  else
    v_cost := p_paid_stake;
  end if;

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;
  if v_balance < v_cost then
    raise exception 'insufficient VIBE: need %, have %', v_cost, v_balance;
  end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  if v_cost > 0 then
    select id into v_burn from public.accounts
    where kind = 'system_burn' and currency = 'vibe' and code = 'locker_wheel_burn';
    if v_burn is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'locker_wheel_burn')
      returning id into v_burn;
    end if;
  end if;

  v_roll := random();
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
  end loop;
  v_pick := v_roll * v_total;
  v_total := 0;
  v_idx := 1;
  for v_i in 1..array_length(v_weights, 1) loop
    v_total := v_total + v_weights[v_i];
    if v_pick <= v_total then
      v_idx := v_i;
      exit;
    end if;
  end loop;

  v_label := v_segments[v_idx];
  v_payout := v_payouts[v_idx];
  v_ref := 'locker_wheel:' || gen_random_uuid()::text;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'locker_wheel',
    v_ref,
    jsonb_build_object(
      'segment', v_idx,
      'label', v_label,
      'payout', v_payout,
      'cost', v_cost,
      'free_spin', v_free
    ),
    v_user_id
  ) returning id into v_tx_id;

  if v_cost > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, -v_cost, 'vibe'),
      (v_tx_id, v_burn, v_cost, 'vibe');
  end if;

  if v_payout > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, -v_payout, 'vibe');
  end if;

  insert into public.locker_wheel_daily (user_id, spin_date, spins_used)
  values (v_user_id, v_today, 1)
  on conflict (user_id, spin_date)
  do update set spins_used = public.locker_wheel_daily.spins_used + 1;

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_wallet;

  return query
    select v_idx - 1, v_label, v_payout, v_cost, v_payout - v_cost, v_balance, v_free;
end;
$$;

revoke all on function public.spin_locker_wheel(bigint) from public;
grant execute on function public.spin_locker_wheel(bigint) to authenticated;
