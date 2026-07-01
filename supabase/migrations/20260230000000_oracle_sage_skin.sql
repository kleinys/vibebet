-- Male oracle skin (free alternative to default female oracle)
insert into public.shop_items (slug, name, description, kind, rarity, price_gems) values
  (
    'oracle-sage',
    'Oracle Sage',
    'Male oracle robes — same companion path, different trainer look.',
    'skin',
    'common',
    0
  )
on conflict (slug) do nothing;
