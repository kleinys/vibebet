-- Inactive grant-only items (e.g. founder-badge) must still resolve when joined
-- from user_inventory for equip + profile display.

create policy shop_items_read_owned_inventory on public.shop_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.user_inventory ui
      where ui.item_id = shop_items.id
        and ui.user_id = auth.uid()
    )
  );
