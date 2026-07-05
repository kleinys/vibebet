-- Step 2: Trinity shop pricing + spend_vibe_for_item
-- PREREQUISITE: Run 20260230900000_trinity_item_kind_enum.sql FIRST (separate queries).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'item_kind'
      AND e.enumlabel = 'animal'
  ) THEN
    RAISE EXCEPTION
      'Missing enum value "animal". Run Step 1 first in a NEW SQL tab:

ALTER TYPE public.item_kind ADD VALUE ''animal'';
ALTER TYPE public.item_kind ADD VALUE ''phenomenon'';

Then verify:
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = ''item_kind'';

Then run this file again.';
  END IF;
END $$;

alter table public.shop_items
  add column if not exists price_vibe bigint not null default 0 check (price_vibe >= 0);

create index if not exists shop_items_price_vibe_idx on public.shop_items (price_vibe) where price_vibe > 0;

create temp table _trinity_skin_prices (
  slug text primary key,
  rank int not null,
  trainer_vibe bigint not null,
  gem_price bigint not null,
  rarity text not null
) on commit drop;

insert into _trinity_skin_prices (slug, rank, trainer_vibe, gem_price, rarity) values
  ('default-oracle', 0, 0, 0, 'common'),
  ('oracle-sage', 1, 220, 150, 'common'),
  ('oracle-lunar', 2, 473, 322, 'common'),
  ('oracle-solar', 3, 1017, 693, 'rare'),
  ('neon-seer', 4, 2187, 1490, 'rare'),
  ('void-prophet', 5, 4702, 3204, 'epic'),
  ('cosmic-oracle', 6, 10109, 6888, 'epic'),
  ('ember-knight', 7, 21734, 14809, 'epic'),
  ('frost-walker', 8, 46728, 31840, 'legendary'),
  ('storm-titan', 9, 100465, 68456, 'legendary'),
  ('nebula-ronin', 10, 216000, 147180, 'legendary'),
  ('blood-moon', 11, 464400, 316437, 'legendary'),
  ('aurora-sage', 12, 998460, 680340, 'legendary');

update public.shop_items si
set
  price_vibe = t.trainer_vibe,
  price_gems = t.gem_price,
  rarity = t.rarity
from _trinity_skin_prices t
where si.slug = t.slug and si.kind = 'skin';

insert into public.shop_items (slug, name, description, kind, rarity, price_gems, price_vibe)
select
  t.slug || '--animal',
  initcap(replace(t.slug, '-', ' ')) || ' · Spirit',
  'Spirit animal piece — pair with trainer skin + phenomenon for trinity buff.',
  'animal'::public.item_kind,
  t.rarity,
  0,
  greatest(180, (t.trainer_vibe * 0.82)::bigint)
from _trinity_skin_prices t
where t.rank >= 1
on conflict (slug) do update set
  price_vibe = excluded.price_vibe,
  price_gems = 0,
  description = excluded.description,
  name = excluded.name;

insert into public.shop_items (slug, name, description, kind, rarity, price_gems, price_vibe)
select
  t.slug || '--phenomenon',
  initcap(replace(t.slug, '-', ' ')) || ' · Phenomenon',
  'Orbit phenomenon piece — completes the trinity loadout buff.',
  'phenomenon'::public.item_kind,
  t.rarity,
  0,
  greatest(180, (t.trainer_vibe * 0.82)::bigint)
from _trinity_skin_prices t
where t.rank >= 1
on conflict (slug) do update set
  price_vibe = excluded.price_vibe,
  price_gems = 0,
  description = excluded.description,
  name = excluded.name;

create or replace function public.spend_vibe_for_item(
  p_item_id uuid
) returns uuid
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

  if v_item.price_vibe <= 0 then
    raise exception 'item is not sold for VIBE';
  end if;

  select id into v_inv_id from public.user_inventory
  where user_id = v_user_id and item_id = p_item_id;

  if v_inv_id is not null then
    raise exception 'already owned';
  end if;

  select id into v_user_wallet from public.accounts
  where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';

  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where account_id = v_user_wallet;

  if v_balance < v_item.price_vibe then
    raise exception 'insufficient VIBE: have %, need %', v_balance, v_item.price_vibe;
  end if;

  select id into v_burn_account from public.accounts
  where kind = 'system_burn'::account_kind and currency = 'vibe'::currency and code = 'shop_vibe_burn';

  if v_burn_account is null then
    insert into public.accounts (kind, currency, code)
    values ('system_burn'::account_kind, 'vibe'::currency, 'shop_vibe_burn')
    returning id into v_burn_account;
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'vibe_spend_item',
    'vibe_spend:' || v_user_id::text || ':' || p_item_id::text,
    jsonb_build_object('item_id', p_item_id, 'price_vibe', v_item.price_vibe),
    v_user_id
  )
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_user_wallet, -v_item.price_vibe, 'vibe'),
    (v_tx_id, v_burn_account, v_item.price_vibe, 'vibe');

  insert into public.user_inventory (user_id, item_id)
  values (v_user_id, p_item_id)
  returning id into v_inv_id;

  return v_inv_id;
end;
$$;

revoke execute on function public.spend_vibe_for_item(uuid) from public;
grant execute on function public.spend_vibe_for_item(uuid) to authenticated;
