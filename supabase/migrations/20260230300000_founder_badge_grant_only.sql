-- Founder badge is grant-only (early supporters), not a free shop purchase.

update public.shop_items
set is_active = false
where slug = 'founder-badge';

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

  if v_item.slug = 'founder-badge' then
    raise exception 'Founder badge is grant-only and cannot be purchased';
  end if;

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

revoke execute on function public.spend_gems_for_item(uuid) from public;
grant execute on function public.spend_gems_for_item(uuid) to authenticated;
