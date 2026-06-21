-- =============================================================================
-- Repair: signup trigger chain (fixes "Database error saving new user")
-- =============================================================================
-- Supabase shows that generic message when ANY trigger on auth.users fails.
-- Our signup flow is:
--
--   auth.users INSERT
--     └─ on_auth_user_created → handle_new_user()
--          inserts public.profiles (id, display_name)
--     └─ on_profile_created → handle_new_profile()
--          creates vibe + gem wallets, grants 1000 VIBE via ledger
--
-- Common causes of failure:
--   1. Trigger was manually edited to reference a non-existent column
--      (e.g. profiles.vibe_balance — we use the ledger, NOT a balance column).
--   2. Trigger was dropped during manual SQL experiments.
--   3. supabase_auth_admin lacks EXECUTE on the trigger function.
--   4. enforce_zero_sum runs at COMMIT as supabase_auth_admin (the auth session
--      user) but is NOT security definer → "permission denied for table
--      ledger_entries". This is the error shown in Postgres Logs.
--
-- This migration is idempotent. Safe to re-run.
-- =============================================================================

-- Clean up a phantom column if someone added it following bad advice.
-- Balances live in accounts + ledger_entries, NOT on profiles.
alter table public.profiles drop column if exists vibe_balance;

-- -----------------------------------------------------------------------------
-- Step 1: profile row when auth.users row appears
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email, 'player'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Step 2: wallets + 1000 VIBE signup bonus when profile appears
-- -----------------------------------------------------------------------------
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
begin
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

-- Re-wire triggers (drop first so re-run is safe).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Supabase Auth runs the auth.users trigger as supabase_auth_admin.
-- Without EXECUTE, you get the opaque "Database error saving new user".
grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.handle_new_profile() to supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Step 3: fix enforce_zero_sum for auth signup commits
--
-- ledger_entries uses a DEFERRED constraint trigger that fires at COMMIT.
-- Signup runs as supabase_auth_admin, so the zero-sum check must run with
-- elevated privileges — otherwise COMMIT fails with:
--   permission denied for table ledger_entries
-- -----------------------------------------------------------------------------
create or replace function public.enforce_zero_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unbalanced integer;
  txn_id     uuid := coalesce(new.transaction_id, old.transaction_id);
begin
  select count(*) into unbalanced
  from (
    select currency, sum(amount) as total
    from public.ledger_entries
    where transaction_id = txn_id
    group by currency
    having sum(amount) <> 0
  ) t;

  if unbalanced > 0 then
    raise exception 'ledger_zero_sum_violation: transaction % does not balance', txn_id;
  end if;
  return null;
end;
$$;
