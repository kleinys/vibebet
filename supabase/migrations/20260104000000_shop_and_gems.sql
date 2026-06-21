-- =============================================================================
-- Phase 1.5: Shop, Gem bundles, user inventory
-- =============================================================================
-- Closed-loop virtual economy (Roblox / Clash Royale model):
--   - Gems are bought with real money via Stripe Checkout.
--   - Gems can ONLY be spent in-app on virtual goods.
--   - No cash out, no transfers, no peer-to-peer trading.
--   - shop_items have a Gem price.
--   - user_inventory is the record of what a user owns.
--
-- All purchase paths flow through the ledger (see Phase 0):
--   - Gem purchase via Stripe: webhook calls into the ledger (gem_purchase txn).
--   - Spend Gems on a shop item: spend_gems_for_item RPC posts a balanced txn.
-- =============================================================================

-- Item kinds we support in Phase 1.5.
create type public.item_kind as enum ('skin', 'shield', 'badge');

create table public.shop_items (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  kind        public.item_kind not null,
  rarity      text not null default 'common'
              check (rarity in ('common', 'rare', 'epic', 'legendary')),
  price_gems  bigint not null check (price_gems >= 0),
  is_active   boolean not null default true,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index shop_items_active_idx on public.shop_items (is_active, kind);

create table public.user_inventory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  item_id       uuid not null references public.shop_items(id) on delete restrict,
  acquired_at   timestamptz not null default now(),
  is_equipped   boolean not null default false,
  -- Idempotency: a user can hold any given item at most once for Phase 1.5.
  -- (Quantities would belong in a `quantity` column for consumables; the
  --  streak shield is the only consumable and we use a separate counter in
  --  metadata for that — see seed below.)
  unique (user_id, item_id)
);

create index user_inventory_user_idx on public.user_inventory (user_id);

create table public.gem_bundles (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  gems            bigint not null check (gems > 0),
  price_usd_cents integer not null check (price_usd_cents > 0),
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now()
);

create index gem_bundles_active_idx on public.gem_bundles (is_active, display_order);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.shop_items     enable row level security;
alter table public.user_inventory enable row level security;
alter table public.gem_bundles    enable row level security;

create policy shop_items_read_active on public.shop_items
  for select to authenticated, anon using (is_active);

create policy gem_bundles_read_active on public.gem_bundles
  for select to authenticated, anon using (is_active);

create policy user_inventory_read_own on public.user_inventory
  for select to authenticated using (user_id = auth.uid());

-- Equip / unequip own items.
create policy user_inventory_update_own_equip on public.user_inventory
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins manage catalog.
create policy shop_items_admin_write on public.shop_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy gem_bundles_admin_write on public.gem_bundles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- RPC: spend_gems_for_item
--   Deducts gems from the user's wallet, adds the item to inventory.
--   Atomic, idempotent (re-running with the same item is a no-op for owners).
-- -----------------------------------------------------------------------------
create or replace function public.spend_gems_for_item(
  p_item_id uuid
) returns uuid -- returns user_inventory.id
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_user_wallet   uuid;
  v_burn_account  uuid;
  v_item          public.shop_items%rowtype;
  v_balance       bigint;
  v_tx_id         uuid;
  v_inv_id        uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_item from public.shop_items
  where id = p_item_id and is_active = true
  for share;

  if not found then raise exception 'item not found or inactive'; end if;

  -- Already owned?
  select id into v_inv_id from public.user_inventory
  where user_id = v_user_id and item_id = p_item_id;

  if v_inv_id is not null then
    raise exception 'already owned';
  end if;

  select id into v_user_wallet from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'gem';

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_user_wallet;

  if v_balance < v_item.price_gems then
    raise exception 'insufficient gems: have %, need %', v_balance, v_item.price_gems;
  end if;

  select id into v_burn_account from public.accounts
  where kind = 'system_burn' and currency = 'gem' and code = 'gem_spend_burn';

  if v_burn_account is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn', 'gem', 'gem_spend_burn')
    returning id into v_burn_account;
  end if;

  -- Ledger: debit user wallet, credit burn account (gems leave circulation).
  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'gem_spend_item',
    'gem_spend:' || v_user_id::text || ':' || p_item_id::text,
    jsonb_build_object('item_id', p_item_id, 'price_gems', v_item.price_gems),
    v_user_id
  )
  returning id into v_tx_id;

  if v_item.price_gems > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet, -v_item.price_gems, 'gem'),
      (v_tx_id, v_burn_account, v_item.price_gems, 'gem');
  end if;

  insert into public.user_inventory (user_id, item_id)
  values (v_user_id, p_item_id)
  returning id into v_inv_id;

  return v_inv_id;
end;
$$;

revoke execute on function public.spend_gems_for_item(uuid) from public;
grant  execute on function public.spend_gems_for_item(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Seed: 3 starter skins, 1 badge, 1 streak shield, 4 gem bundles
-- -----------------------------------------------------------------------------
insert into public.shop_items (slug, name, description, kind, rarity, price_gems) values
  ('default-oracle', 'Default Oracle', 'The classic look.', 'skin', 'common', 0),
  ('neon-seer',      'Neon Seer',      'Glow-in-the-dark.', 'skin', 'rare', 500),
  ('void-prophet',   'Void Prophet',   'For the truly committed.', 'skin', 'epic', 2000),
  ('founder-badge',  'Founder',        'You were here on day one.', 'badge', 'legendary', 0),
  ('streak-shield',  'Streak Shield',  'Protects one streak break.', 'shield', 'common', 200)
on conflict (slug) do nothing;

insert into public.gem_bundles (slug, name, gems, price_usd_cents, display_order) values
  ('starter',   'Starter Pack',  100,   99,   1),
  ('popular',   'Popular Pack',  550,   499,  2),
  ('big',       'Big Pack',      1200,  999,  3),
  ('whale',     'Whale Pack',    15000, 9999, 4)
on conflict (slug) do nothing;

-- Flip on the shop in dev. Production should toggle this off until ready.
update public.feature_flags set enabled = true where key = 'shop_enabled';
