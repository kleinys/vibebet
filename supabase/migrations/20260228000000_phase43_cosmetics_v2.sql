-- Phase 43: Cosmetics v2 — streak shields, badge equip, public profiles
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists streak_shields int not null default 0;

-- Streak shield: auto-consume when user misses exactly one day
create or replace function public.record_daily_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_today          date := public._today_utc();
  v_profile        public.profiles%rowtype;
  v_streak         int;
  v_shield_used    boolean := false;
  v_shields_left   int;
begin
  if v_user_id is null then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then return jsonb_build_object('skipped', true); end if;

  if v_profile.last_active_date = v_today then
    return jsonb_build_object(
      'current_streak', v_profile.current_streak,
      'streak_shields', v_profile.streak_shields,
      'already_recorded', true
    );
  end if;

  v_shields_left := v_profile.streak_shields;

  if v_profile.last_active_date = v_today - 1 then
    v_streak := v_profile.current_streak + 1;
  elsif v_profile.last_active_date = v_today - 2
        and v_profile.streak_shields > 0 then
    v_streak := v_profile.current_streak + 1;
    v_shields_left := v_profile.streak_shields - 1;
    v_shield_used := true;
  else
    v_streak := 1;
  end if;

  update public.profiles
     set current_streak   = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_active_date = v_today,
         streak_shields   = v_shields_left,
         updated_at       = now()
   where id = v_user_id;

  begin
    perform public.check_achievements(v_user_id);
  exception when others then null;
  end;

  begin
    perform public.grant_battle_pass_xp(15);
  exception when others then null;
  end;

  begin
    perform public._tick_daily_hustle(v_user_id, 'login', 1);
  exception when others then null;
  end;

  return jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', greatest(v_profile.longest_streak, v_streak),
    'streak_shields', v_shields_left,
    'shield_used', v_shield_used,
    'already_recorded', false
  );
end;
$$;

-- Shields are consumable: repurchase adds charges; other items stay one-per-user
create or replace function public.spend_gems_for_item(
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

  select id into v_inv_id from public.user_inventory
  where user_id = v_user_id and item_id = p_item_id;

  if v_inv_id is not null and v_item.kind <> 'shield' then
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

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'gem_spend_item',
    'gem_spend:' || v_user_id::text || ':' || p_item_id::text || ':' || gen_random_uuid()::text,
    jsonb_build_object('item_id', p_item_id, 'price_gems', v_item.price_gems),
    v_user_id
  )
  returning id into v_tx_id;

  if v_item.price_gems > 0 then
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet, -v_item.price_gems, 'gem'),
      (v_tx_id, v_burn_account, v_item.price_gems, 'gem');
  end if;

  if v_item.kind = 'shield' then
    update public.profiles
       set streak_shields = streak_shields + 1,
           updated_at = now()
     where id = v_user_id;

    if v_inv_id is null then
      insert into public.user_inventory (user_id, item_id)
      values (v_user_id, p_item_id)
      returning id into v_inv_id;
    end if;

    return v_inv_id;
  end if;

  insert into public.user_inventory (user_id, item_id)
  values (v_user_id, p_item_id)
  returning id into v_inv_id;

  return v_inv_id;
end;
$$;

-- Public profile card for /players/[username]
create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile   public.profiles%rowtype;
  v_skin_slug text;
  v_badge_slug text;
  v_profit    bigint := 0;
  v_rank      integer;
begin
  if p_username is null or trim(p_username) = '' then
    return null;
  end if;

  select * into v_profile
  from public.profiles
  where lower(username) = lower(trim(p_username));

  if not found then return null; end if;

  select si.slug into v_skin_slug
  from public.user_inventory ui
  join public.shop_items si on si.id = ui.item_id
  where ui.user_id = v_profile.id
    and ui.is_equipped = true
    and si.kind = 'skin'
  limit 1;

  select si.slug into v_badge_slug
  from public.user_inventory ui
  join public.shop_items si on si.id = ui.item_id
  where ui.user_id = v_profile.id
    and ui.is_equipped = true
    and si.kind = 'badge'
  limit 1;

  select l.profit, l.rank into v_profit, v_rank
  from public.leaderboard(500) l
  where l.user_id = v_profile.id
  limit 1;

  return jsonb_build_object(
    'user_id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'skin_slug', coalesce(v_skin_slug, 'default-oracle'),
    'badge_slug', v_badge_slug,
    'current_streak', v_profile.current_streak,
    'longest_streak', v_profile.longest_streak,
    'streak_shields', v_profile.streak_shields,
    'is_pro', v_profile.is_pro,
    'profit', coalesce(v_profit, 0),
    'rank', v_rank,
    'member_since', v_profile.created_at
  );
end;
$$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- Extra cosmetics
insert into public.shop_items (slug, name, description, kind, rarity, price_gems) values
  ('cosmic-oracle', 'Cosmic Oracle', 'Stellar rings and deep-space glow.', 'skin', 'epic', 1200),
  ('ember-knight',  'Ember Knight',  'Forged in prediction fire.', 'skin', 'rare', 750),
  ('verified-seer', 'Verified Seer', 'Stand out in the Hall of Fame.', 'badge', 'rare', 350)
on conflict (slug) do nothing;

-- Ensure arcade flag row exists (Admin sync also covers this)
insert into public.feature_flags (key, enabled, description)
values ('arcade_games_enabled', false, 'Coin Flip + Dice Duel at /games/arcade')
on conflict (key) do update set description = excluded.description;
