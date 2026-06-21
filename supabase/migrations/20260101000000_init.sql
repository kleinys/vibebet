-- =============================================================================
-- Vibebet Phase 0: Foundation
-- =============================================================================
-- Goals:
--   1. Profiles tied to auth.users.
--   2. Double-entry, append-only ledger for two virtual currencies:
--        - vibe : earned through play (free)
--        - gem  : purchased with real money (closed-loop, non-withdrawable)
--   3. Per-user wallet accounts + system mint/burn/revenue accounts.
--   4. Strict RLS: users can only read their own wallets / ledger entries.
--   5. Feature flags table (everything off by default, including real_money).
--   6. Admin role check based on JWT app_metadata.role (NOT user_metadata —
--      user_metadata is client-editable and unsafe for authz).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, 1:1 with auth.users.';

-- -----------------------------------------------------------------------------
-- Ledger primitives
-- -----------------------------------------------------------------------------
create type public.currency as enum ('vibe', 'gem');

create type public.account_kind as enum (
  'user_wallet',     -- A user's balance for one currency
  'system_mint',     -- Source of issued currency
  'system_burn',     -- Sink for destroyed currency
  'system_revenue'   -- Off-ledger USD revenue recognition (gem purchases)
);

create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  kind          public.account_kind not null,
  currency      public.currency not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  code          text,
  created_at    timestamptz not null default now()
);

-- One wallet per (user, currency).
create unique index accounts_user_wallet_unique
  on public.accounts (kind, currency, owner_user_id)
  where kind = 'user_wallet';

-- One system account per (kind, currency, code).
create unique index accounts_system_unique
  on public.accounts (kind, currency, code)
  where kind <> 'user_wallet';

-- Constrain shape:
--   user_wallet  → owner_user_id required, code null
--   system_*     → owner_user_id null,    code required
alter table public.accounts add constraint accounts_shape_check check (
  (kind = 'user_wallet' and owner_user_id is not null and code is null)
  or
  (kind <> 'user_wallet' and owner_user_id is null and code is not null)
);

-- Ledger transactions: one row per business event (gem purchase, signup
-- bonus, market settlement, etc). Entries hang off these.
create table public.ledger_transactions (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  external_ref text unique,
  metadata     jsonb not null default '{}'::jsonb,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

comment on column public.ledger_transactions.external_ref is
  'Unique key used for idempotency (e.g. stripe_event_id, signup:USER_ID).';

create table public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id     uuid not null references public.accounts(id) on delete restrict,
  -- Signed integer amount in the smallest unit of the currency.
  -- vibe and gem are integer currencies (no fractions).
  -- Positive = credit to this account, negative = debit.
  amount         bigint not null,
  currency       public.currency not null,
  created_at     timestamptz not null default now()
);

create index ledger_entries_account_idx     on public.ledger_entries (account_id, created_at desc);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);

-- -----------------------------------------------------------------------------
-- Invariant: per transaction, entries sum to zero per currency.
-- This is the core double-entry guarantee. Implemented as a deferred constraint
-- trigger so multi-row inserts within a transaction can balance.
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

create constraint trigger ledger_entries_zero_sum
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.enforce_zero_sum();

-- -----------------------------------------------------------------------------
-- Invariant: ledger is append-only.
-- -----------------------------------------------------------------------------
create or replace function public.ledger_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger_immutable: % not allowed on %', tg_op, tg_table_name;
end;
$$;

create trigger ledger_entries_no_mutation
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_immutable();

create trigger ledger_transactions_no_mutation
  before update or delete on public.ledger_transactions
  for each row execute function public.ledger_immutable();

-- -----------------------------------------------------------------------------
-- Derived balance view (source of truth: sum of entries on the user's wallets).
-- security_invoker = true so RLS on underlying tables applies to view callers.
-- -----------------------------------------------------------------------------
create view public.user_balances
with (security_invoker = true) as
select
  a.owner_user_id              as user_id,
  a.currency                   as currency,
  coalesce(sum(le.amount), 0)::bigint as balance
from public.accounts a
left join public.ledger_entries le on le.account_id = a.id
where a.kind = 'user_wallet'
group by a.owner_user_id, a.currency;

comment on view public.user_balances is
  'Balances derived from the ledger. Always recomputed; never cache writes.';

-- -----------------------------------------------------------------------------
-- Feature flags
-- -----------------------------------------------------------------------------
create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

insert into public.feature_flags (key, enabled, description) values
  ('shop_enabled',        false, 'Master switch for Gem shop UI and purchases'),
  ('markets_enabled',     false, 'Master switch for prediction markets'),
  ('battle_pass_enabled', false, 'Seasonal battle pass'),
  ('ads_enabled',         false, 'Show ads on free tier'),
  ('real_money_enabled',  false,
    'Real-money features. MUST stay false in Phases 0-4. Phase 5+ only and only in licensed jurisdictions.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Admin role check
--
-- IMPORTANT: We read role from app_metadata, NOT user_metadata.
-- user_metadata is client-editable through the auth API and is unsafe.
-- app_metadata can only be set with the service_role key.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.accounts            enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries      enable row level security;
alter table public.feature_flags       enable row level security;

-- Profiles: readable by all signed-in users (for social later), updatable
-- only by the owner. Inserts happen via a security-definer trigger.
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Accounts: a user can read only their own wallets. No client writes.
create policy accounts_select_own on public.accounts
  for select to authenticated using (
    kind = 'user_wallet' and owner_user_id = auth.uid()
  );

-- Ledger entries: user can read entries that touch their own accounts.
create policy ledger_entries_select_own on public.ledger_entries
  for select to authenticated using (
    exists (
      select 1 from public.accounts a
      where a.id = ledger_entries.account_id
        and a.owner_user_id = auth.uid()
    )
  );

-- Ledger transactions: user can read transactions that touch their accounts.
create policy ledger_transactions_select_own on public.ledger_transactions
  for select to authenticated using (
    exists (
      select 1
      from public.ledger_entries le
      join public.accounts a on a.id = le.account_id
      where le.transaction_id = ledger_transactions.id
        and a.owner_user_id = auth.uid()
    )
  );

-- Feature flags: readable by everyone (used for client gating); writable by
-- admins only.
create policy feature_flags_select_all on public.feature_flags
  for select to authenticated, anon using (true);

create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- New-user wiring
--   1. Auto-insert profile when auth.users row appears.
--   2. After profile insert, create the two wallet accounts (vibe + gem).
--   3. After wallet creation, grant 1000 VIBE signup bonus through the ledger.
-- All three are SECURITY DEFINER so they can bypass RLS.
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
  -- Create the two wallets.
  insert into public.accounts (kind, currency, owner_user_id) values
    ('user_wallet', 'vibe', new.id),
    ('user_wallet', 'gem',  new.id);

  -- Look up the user's VIBE wallet.
  select id into v_user_wallet
  from public.accounts
  where owner_user_id = new.id
    and kind = 'user_wallet'
    and currency = 'vibe';

  -- Get or create the system VIBE mint.
  select id into v_system_mint
  from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

  if v_system_mint is null then
    insert into public.accounts (kind, currency, code)
    values ('system_mint', 'vibe', 'vibe_mint')
    returning id into v_system_mint;
  end if;

  -- Grant 1000 VIBE signup bonus (idempotent via external_ref).
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

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();
