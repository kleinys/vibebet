-- =============================================================================
-- Phase 19: Referral rewards + weekly digest
-- =============================================================================

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users(id) on delete set null,
  add column if not exists email_digest_enabled boolean not null default true;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code)
  where referral_code is not null;

create table if not exists public.referral_rewards (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references auth.users(id) on delete cascade,
  referee_id   uuid not null references auth.users(id) on delete cascade,
  reward_kind  text not null check (reward_kind in ('signup', 'first_bet')),
  vibe_amount  bigint not null check (vibe_amount > 0),
  created_at   timestamptz not null default now(),
  unique (referee_id, reward_kind)
);

create index if not exists referral_rewards_referrer_idx
  on public.referral_rewards (referrer_id, created_at desc);

alter table public.referral_rewards enable row level security;

drop policy if exists referral_rewards_select_involved on public.referral_rewards;
create policy referral_rewards_select_involved on public.referral_rewards
  for select to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid());

-- Assign referral_code when profile is created.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id        uuid;
  v_user_wallet  uuid;
  v_system_mint  uuid;
  v_code         text;
begin
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  while exists (select 1 from public.profiles p where p.referral_code = v_code) loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end loop;

  update public.profiles
  set referral_code = v_code
  where id = new.id and referral_code is null;

  insert into public.accounts (kind, currency, owner_user_id) values
    ('user_wallet', 'vibe', new.id),
    ('user_wallet', 'gem',  new.id);

  select id into v_user_wallet
    from public.accounts
   where owner_user_id = new.id
     and kind = 'user_wallet'
     and currency = 'vibe';
  if v_user_wallet is null then
    raise exception 'signup: vibe wallet missing for user %', new.id;
  end if;

  select id into v_system_mint
    from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  if v_system_mint is null then
    insert into public.accounts (kind, currency, code)
    values ('system_mint', 'vibe', 'vibe_mint')
    returning id into v_system_mint;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'signup_bonus',
    'signup_bonus:' || new.id::text,
    jsonb_build_object('amount', 1000, 'currency', 'vibe'),
    new.id
  )
  on conflict (external_ref) do nothing
  returning id into v_tx_id;

  if v_tx_id is not null then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency)
    values
      (v_tx_id, v_user_wallet, 1000,  'vibe'),
      (v_tx_id, v_system_mint, -1000, 'vibe');
  end if;

  return new;
end;
$$;

create or replace function public._pay_referral_vibe(
  p_referrer_id uuid,
  p_referee_id uuid,
  p_kind text,
  p_amount bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id       uuid;
  v_referrer_w  uuid;
  v_system_mint uuid;
  v_external    text;
  v_reward_id   uuid;
begin
  v_external := 'referral:' || p_kind || ':' || p_referee_id::text;

  insert into public.referral_rewards (referrer_id, referee_id, reward_kind, vibe_amount)
  values (p_referrer_id, p_referee_id, p_kind, p_amount)
  on conflict (referee_id, reward_kind) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return false;
  end if;

  select id into v_referrer_w
    from public.accounts
   where owner_user_id = p_referrer_id
     and kind = 'user_wallet'
     and currency = 'vibe';

  select id into v_system_mint
    from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'referral_reward',
    v_external,
    jsonb_build_object(
      'referrer_id', p_referrer_id,
      'referee_id', p_referee_id,
      'reward_kind', p_kind,
      'amount', p_amount
    ),
    p_referrer_id
  )
  on conflict (external_ref) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    return false;
  end if;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency)
  values
    (v_tx_id, v_referrer_w, p_amount, 'vibe'),
    (v_tx_id, v_system_mint, -p_amount, 'vibe');

  return true;
end;
$$;

revoke execute on function public._pay_referral_vibe(uuid, uuid, text, bigint) from public;

create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_referrer   uuid;
  v_normalized text := upper(trim(p_code));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized is null or length(v_normalized) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Invalid code');
  end if;

  select id into v_referrer
    from public.profiles
   where referral_code = v_normalized;

  if v_referrer is null then
    return jsonb_build_object('ok', false, 'error', 'Code not found');
  end if;

  if v_referrer = v_user_id then
    return jsonb_build_object('ok', false, 'error', 'Cannot use your own code');
  end if;

  update public.profiles
  set referred_by = v_referrer
  where id = v_user_id
    and referred_by is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Referral already applied');
  end if;

  perform public._pay_referral_vibe(v_referrer, v_user_id, 'signup', 100);

  return jsonb_build_object('ok', true, 'referrer_id', v_referrer);
end;
$$;

revoke execute on function public.apply_referral_code(text) from public;
grant  execute on function public.apply_referral_code(text) to authenticated;

create or replace function public.try_referral_first_bet_reward()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_referrer   uuid;
  v_paid       boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('paid', false);
  end if;

  select referred_by into v_referrer
    from public.profiles
   where id = v_user_id;

  if v_referrer is null then
    return jsonb_build_object('paid', false);
  end if;

  v_paid := public._pay_referral_vibe(v_referrer, v_user_id, 'first_bet', 250);

  return jsonb_build_object('paid', coalesce(v_paid, false));
end;
$$;

revoke execute on function public.try_referral_first_bet_reward() from public;
grant  execute on function public.try_referral_first_bet_reward() to authenticated;

create or replace function public.get_my_referral_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'referral_code', p.referral_code,
    'referred_by', p.referred_by,
    'invite_count', (
      select count(*)::int from public.profiles r where r.referred_by = auth.uid()
    ),
    'total_vibe_earned', coalesce((
      select sum(rr.vibe_amount)::bigint
      from public.referral_rewards rr
      where rr.referrer_id = auth.uid()
    ), 0),
    'recent_invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'display_name', rp.display_name,
        'joined_at', rp.created_at
      ) order by rp.created_at desc)
      from (
        select rp.display_name, rp.created_at
        from public.profiles rp
        where rp.referred_by = auth.uid()
        order by rp.created_at desc
        limit 10
      ) rp
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.get_my_referral_stats() from public;
grant  execute on function public.get_my_referral_stats() to authenticated;

create or replace function public.set_email_digest_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email_digest_enabled = coalesce(p_enabled, false)
  where id = auth.uid();
end;
$$;

revoke execute on function public.set_email_digest_enabled(boolean) from public;
grant  execute on function public.set_email_digest_enabled(boolean) to authenticated;

create or replace function public.get_weekly_digest()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_week_start timestamptz := date_trunc('week', now());
  v_trades    int := 0;
  v_volume    bigint := 0;
  v_wins      int := 0;
  v_losses    int := 0;
  v_profit    bigint := 0;
  v_top_market text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    count(*)::int,
    coalesce(sum(abs(t.cost)), 0)::bigint
  into v_trades, v_volume
  from public.trades t
  where t.user_id = v_user_id
    and t.created_at >= v_week_start;

  select count(*)::int into v_wins
  from public.notifications n
  where n.user_id = v_user_id
    and n.kind = 'bet_won'
    and n.created_at >= v_week_start;

  select count(*)::int into v_losses
  from public.notifications n
  where n.user_id = v_user_id
    and n.kind = 'bet_lost'
    and n.created_at >= v_week_start;

  select coalesce(sum(le.amount), 0)::bigint into v_profit
  from public.ledger_entries le
  join public.accounts a on a.id = le.account_id
  join public.ledger_transactions lt on lt.id = le.transaction_id
  where a.owner_user_id = v_user_id
    and a.currency = 'vibe'
    and lt.created_at >= v_week_start
    and lt.kind in ('market_payout', 'sell_shares', 'referral_reward', 'quest_reward', 'tournament_payout');

  select m.question into v_top_market
  from public.trades t
  join public.markets m on m.id = t.market_id
  where t.user_id = v_user_id
    and t.created_at >= v_week_start
  group by m.id, m.question
  order by sum(abs(t.cost)) desc
  limit 1;

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_label', to_char(v_week_start, 'Mon DD, YYYY'),
    'trades_count', v_trades,
    'volume', v_volume,
    'wins', v_wins,
    'losses', v_losses,
    'profit_estimate', v_profit,
    'top_market', v_top_market,
    'email_digest_enabled', (
      select p.email_digest_enabled from public.profiles p where p.id = v_user_id
    )
  );
end;
$$;

revoke execute on function public.get_weekly_digest() from public;
grant  execute on function public.get_weekly_digest() to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('referrals_enabled', false, 'Invite links — 100 VIBE on signup, 250 VIBE on friend first bet'),
  ('weekly_digest_enabled', false, 'Weekly recap at /account/digest (+ email when provider wired)')
on conflict (key) do update set description = excluded.description;

-- Backfill referral codes for existing profiles.
do $$
declare
  r record;
  v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    while exists (select 1 from public.profiles p where p.referral_code = v_code) loop
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end;
$$;
