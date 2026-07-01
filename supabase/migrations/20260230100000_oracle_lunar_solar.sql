-- Lunar & Solar oracle skins + companion animals (stag / phoenix)
insert into public.shop_items (slug, name, description, kind, rarity, price_gems) values
  (
    'oracle-lunar',
    'Oracle Lunar',
    'Moonlit silver robes — pairs with the Spirit Stag companion.',
    'skin',
    'common',
    0
  ),
  (
    'oracle-solar',
    'Oracle Solar',
    'Sun-forged gold robes — pairs with the Sun Phoenix companion.',
    'skin',
    'common',
    0
  )
on conflict (slug) do nothing;
