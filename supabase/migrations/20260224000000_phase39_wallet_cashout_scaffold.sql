-- Phase 39: Wallet / cashout scaffold (DISABLED by default — legal review required before enabling)

insert into public.feature_flags (key, enabled, description)
values
  ('gems_cashout_enabled', false, 'Allow Gem withdrawal requests — requires KYC, Stripe Connect, legal sign-off'),
  ('gem_to_vibe_conversion_enabled', false, 'Allow converting Gems to VIBE at fixed rate (one-way, closed loop)')
on conflict (key) do update set description = excluded.description;

create table if not exists public.withdrawal_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  gems_amount   bigint not null check (gems_amount > 0),
  usd_cents     bigint not null check (usd_cents > 0),
  method        text not null check (method in ('paypal', 'bank', 'stripe', 'crypto')),
  status        text not null default 'pending'
    check (status in ('pending', 'review', 'approved', 'paid', 'rejected', 'cancelled')),
  payout_ref    text,
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists withdrawal_requests_user_idx
  on public.withdrawal_requests (user_id, created_at desc);

alter table public.withdrawal_requests enable row level security;

drop policy if exists withdrawal_requests_select on public.withdrawal_requests;
create policy withdrawal_requests_select on public.withdrawal_requests
  for select to authenticated using (user_id = auth.uid());

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
    (select sum(amount) from public.ledger_entries le
     join public.accounts a on a.id = le.account_id
     where a.user_id = v_user_id and a.currency = 'gem' and a.kind = 'user_wallet'),
    0
  ) into v_balance;

  if p_gems > v_balance then raise exception 'insufficient Gems'; end if;

  -- 100 Gems = $1.00 (adjustable later)
  v_usd := (p_gems * 100) / 100;

  insert into public.withdrawal_requests (user_id, gems_amount, usd_cents, method, status)
  values (v_user_id, p_gems, v_usd, p_method, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.request_gem_withdrawal(bigint, text) from public;
grant execute on function public.request_gem_withdrawal(bigint, text) to authenticated;
