-- Grant all purchasable locker cosmetics to every existing user (skins + badges except founder).
-- Founder badge stays grant-only via admin / migration.

insert into public.user_inventory (user_id, item_id)
select p.id, si.id
from public.profiles p
cross join public.shop_items si
where si.kind in ('skin', 'badge')
  and si.slug <> 'founder-badge'
on conflict (user_id, item_id) do nothing;

-- Callable by authenticated users who are missing items (e.g. signed up after this migration).
create or replace function public.grant_locker_cosmetics()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
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
