-- =============================================================================
-- Phase 47: HustleOS Phase C — Earn ↔ Play wallet bridge
-- =============================================================================

alter table public.profiles
  add column if not exists hustle_cash_vibe bigint not null default 0
    check (hustle_cash_vibe >= 0),
  add column if not exists hustle_daily_transfer_limit bigint not null default 1000
    check (hustle_daily_transfer_limit > 0),
  add column if not exists hustle_weekly_transfer_limit bigint not null default 5000
    check (hustle_weekly_transfer_limit > 0),
  add column if not exists hustle_self_exclude_until timestamptz;

create table if not exists public.hustle_transfers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  direction     text not null check (direction in ('earn_to_play', 'play_to_earn')),
  amount        bigint not null check (amount > 0),
  fee           bigint not null default 0 check (fee >= 0),
  status        text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  requested_at  timestamptz not null default now(),
  completes_at  timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz
);

create index if not exists hustle_transfers_user_status_idx
  on public.hustle_transfers (user_id, status, requested_at desc);

alter table public.hustle_transfers enable row level security;

drop policy if exists hustle_transfers_select_own on public.hustle_transfers;
create policy hustle_transfers_select_own on public.hustle_transfers
  for select to authenticated using (user_id = auth.uid());

-- Constants (VIBE units)
-- earn→play: 1:1, min 50, max 500, daily 1000, 24h cooling if amount > 50
-- play→earn: 0.95 net (5% fee), min 100, max 2000, daily 5000, instant

create or replace function public._hustle_transfer_day_total(
  p_user_id uuid,
  p_direction text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::bigint
  from public.hustle_transfers
  where user_id = p_user_id
    and direction = p_direction
    and status in ('pending', 'completed')
    and requested_at >= (now() at time zone 'utc')::date;
$$;

create or replace function public._complete_hustle_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.hustle_transfers%rowtype;
  v_wallet uuid;
  v_mint uuid;
  v_burn uuid;
  v_tx_id uuid;
  v_net bigint;
begin
  select * into v_row
  from public.hustle_transfers
  where id = p_transfer_id and status = 'pending'
  for update;

  if not found then return; end if;
  if v_row.completes_at is not null and v_row.completes_at > now() then
    return;
  end if;

  select public._wallet_for_user(v_row.user_id) into v_wallet;
  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  select id into v_burn from public.accounts
   where kind = 'system_burn' and currency = 'vibe' and code = 'hustle_bridge_burn';

  if v_burn is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'vibe', 'hustle_bridge_burn')
    returning id into v_burn;
  end if;

  if v_row.direction = 'earn_to_play' then
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'hustle_earn_to_play',
      'hustle_xfer:' || v_row.id::text,
      jsonb_build_object('transfer_id', v_row.id, 'amount', v_row.amount),
      v_row.user_id
    )
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency)
    values
      (v_tx_id, v_wallet, v_row.amount, 'vibe'),
      (v_tx_id, v_mint, -v_row.amount, 'vibe');
  else
    v_net := v_row.amount - v_row.fee;
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'hustle_play_to_earn',
      'hustle_xfer:' || v_row.id::text,
      jsonb_build_object('transfer_id', v_row.id, 'amount', v_row.amount, 'fee', v_row.fee, 'net', v_net),
      v_row.user_id
    )
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency)
    values
      (v_tx_id, v_wallet, -v_row.amount, 'vibe'),
      (v_tx_id, v_burn, v_row.amount, 'vibe');

    update public.profiles
    set hustle_cash_vibe = hustle_cash_vibe + v_net
    where id = v_row.user_id;
  end if;

  update public.hustle_transfers
  set status = 'completed',
      completed_at = now()
  where id = v_row.id;
end;
$$;

create or replace function public._process_due_hustle_transfers(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.hustle_transfers
    where user_id = p_user_id
      and status = 'pending'
      and (completes_at is null or completes_at <= now())
  loop
    perform public._complete_hustle_transfer(v_id);
  end loop;
end;
$$;

create or replace function public.get_hustle_wallet()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_play bigint := 0;
  v_pending jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  perform public._process_due_hustle_transfers(v_user_id);

  select * into v_profile from public.profiles where id = v_user_id;

  select coalesce(sum(le.amount), 0)::bigint into v_play
  from public.ledger_entries le
  join public.accounts a on a.id = le.account_id
  where a.owner_user_id = v_user_id
    and a.kind = 'user_wallet'
    and a.currency = 'vibe';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'direction', t.direction,
    'amount', t.amount,
    'fee', t.fee,
    'status', t.status,
    'requested_at', t.requested_at,
    'completes_at', t.completes_at
  ) order by t.requested_at desc), '[]'::jsonb)
  into v_pending
  from public.hustle_transfers t
  where t.user_id = v_user_id and t.status = 'pending';

  return jsonb_build_object(
    'authenticated', true,
    'hustle_cash', v_profile.hustle_cash_vibe,
    'play_balance', v_play,
    'daily_limit_earn_to_play', v_profile.hustle_daily_transfer_limit,
    'weekly_limit_earn_to_play', v_profile.hustle_weekly_transfer_limit,
    'daily_used_earn_to_play', public._hustle_transfer_day_total(v_user_id, 'earn_to_play'),
    'daily_used_play_to_earn', public._hustle_transfer_day_total(v_user_id, 'play_to_earn'),
    'self_exclude_until', v_profile.hustle_self_exclude_until,
    'pending_transfers', v_pending,
    'cooling_threshold', 50,
    'earn_to_play_fee_pct', 0,
    'play_to_earn_fee_pct', 5
  );
end;
$$;

revoke execute on function public.get_hustle_wallet() from public;
grant execute on function public.get_hustle_wallet() to authenticated;

create or replace function public.request_hustle_transfer(
  p_direction text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_play bigint := 0;
  v_fee bigint := 0;
  v_net bigint;
  v_id uuid;
  v_completes timestamptz;
  v_daily_used bigint;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_direction not in ('earn_to_play', 'play_to_earn') then
    raise exception 'invalid direction';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  perform public._process_due_hustle_transfers(v_user_id);

  select * into v_profile from public.profiles where id = v_user_id for update;

  if v_profile.hustle_self_exclude_until is not null
     and v_profile.hustle_self_exclude_until > now() then
    raise exception 'transfers self-excluded until %', v_profile.hustle_self_exclude_until;
  end if;

  if p_direction = 'earn_to_play' then
    if p_amount < 50 then raise exception 'minimum earn→play transfer is 50 VIBE'; end if;
    if p_amount > 500 then raise exception 'maximum earn→play transfer is 500 VIBE'; end if;
    if v_profile.hustle_cash_vibe < p_amount then raise exception 'insufficient hustle cash'; end if;

    v_daily_used := public._hustle_transfer_day_total(v_user_id, 'earn_to_play');
    if v_daily_used + p_amount > v_profile.hustle_daily_transfer_limit then
      raise exception 'daily earn→play limit exceeded';
    end if;

    update public.profiles
    set hustle_cash_vibe = hustle_cash_vibe - p_amount
    where id = v_user_id;

    v_completes := case when p_amount > 50 then now() + interval '24 hours' else null end;

    insert into public.hustle_transfers (user_id, direction, amount, fee, status, completes_at)
    values (v_user_id, 'earn_to_play', p_amount, 0, 'pending', v_completes)
    returning id into v_id;

    if v_completes is null then
      perform public._complete_hustle_transfer(v_id);
    end if;
  else
    if p_amount < 100 then raise exception 'minimum play→earn transfer is 100 VIBE'; end if;
    if p_amount > 2000 then raise exception 'maximum play→earn transfer is 2000 VIBE'; end if;

    v_daily_used := public._hustle_transfer_day_total(v_user_id, 'play_to_earn');
    if v_daily_used + p_amount > 5000 then
      raise exception 'daily play→earn limit exceeded';
    end if;

    select coalesce(sum(le.amount), 0)::bigint into v_play
    from public.ledger_entries le
    join public.accounts a on a.id = le.account_id
    where a.owner_user_id = v_user_id
      and a.kind = 'user_wallet'
      and a.currency = 'vibe';

    if v_play < p_amount then raise exception 'insufficient play balance'; end if;

    v_fee := floor(p_amount * 0.05)::bigint;
    v_net := p_amount - v_fee;

    insert into public.hustle_transfers (user_id, direction, amount, fee, status, completes_at)
    values (v_user_id, 'play_to_earn', p_amount, v_fee, 'pending', null)
    returning id into v_id;

    perform public._complete_hustle_transfer(v_id);
  end if;

  return jsonb_build_object('ok', true, 'transfer_id', v_id);
end;
$$;

revoke execute on function public.request_hustle_transfer(text, bigint) from public;
grant execute on function public.request_hustle_transfer(text, bigint) to authenticated;

create or replace function public.cancel_hustle_transfer(p_transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.hustle_transfers%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_row
  from public.hustle_transfers
  where id = p_transfer_id and user_id = v_user_id
  for update;

  if not found then raise exception 'transfer not found'; end if;
  if v_row.status <> 'pending' then raise exception 'transfer not cancellable'; end if;
  if v_row.direction <> 'earn_to_play' then raise exception 'only earn→play transfers can be cancelled'; end if;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_row.amount
  where id = v_user_id;

  update public.hustle_transfers
  set status = 'cancelled', cancelled_at = now()
  where id = p_transfer_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.cancel_hustle_transfer(uuid) from public;
grant execute on function public.cancel_hustle_transfer(uuid) to authenticated;

create or replace function public.set_hustle_transfer_limits(
  p_daily_limit bigint,
  p_weekly_limit bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_daily_limit < 50 or p_daily_limit > 1000 then
    raise exception 'daily limit must be between 50 and 1000 VIBE';
  end if;

  update public.profiles
  set hustle_daily_transfer_limit = p_daily_limit,
      hustle_weekly_transfer_limit = coalesce(p_weekly_limit, hustle_weekly_transfer_limit),
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.set_hustle_transfer_limits(bigint, bigint) from public;
grant execute on function public.set_hustle_transfer_limits(bigint, bigint) to authenticated;

-- Hustle claims credit Hustle Cash (not play wallet directly)
create or replace function public.claim_daily_hustle_reward(p_task_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_day       date := public._today_utc();
  v_task      public.daily_hustle_definitions%rowtype;
  v_progress  public.user_daily_hustle_progress%rowtype;
  v_tier      int := 1;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);

  select * into v_task from public.daily_hustle_definitions
   where id = p_task_id and active = true;
  if not found then raise exception 'unknown task'; end if;

  if v_task.min_hustle_tier > v_tier then
    raise exception 'tier locked — unlock % first', v_task.min_hustle_tier;
  end if;

  select * into v_progress from public.user_daily_hustle_progress
   where user_id = v_user_id and task_id = p_task_id and day = v_day;
  if not found or v_progress.completed_at is null then
    raise exception 'task not completed';
  end if;
  if v_progress.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  update public.user_daily_hustle_progress
  set claimed_at = now()
  where user_id = v_user_id and task_id = p_task_id and day = v_day;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_task.reward_vibe,
      spark_claims_lifetime = spark_claims_lifetime + case when v_task.task_kind = 'spark' then 1 else 0 end
  where id = v_user_id;

  perform public._refresh_hustle_trust(v_user_id);

  perform public.track_event('daily_hustle_claimed', jsonb_build_object(
    'task_id', p_task_id,
    'reward', v_task.reward_vibe,
    'task_kind', v_task.task_kind,
    'to_hustle_cash', true
  ));

  return v_task.reward_vibe;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values ('hustle_bridge_enabled', false, 'Hustle Cash ↔ Play VIBE bridge with cooling-off')
on conflict (key) do update set description = excluded.description;
