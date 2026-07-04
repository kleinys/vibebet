-- Extra trainer themes (reuse human art; new spirit animals via SVG fallback).

insert into public.shop_items (slug, name, description, kind, rarity, price_gems) values
  (
    'frost-walker',
    'Frost Walker',
    'Ice-bound robes — pairs with the Frost Serpent companion.',
    'skin',
    'rare',
    650
  ),
  (
    'storm-titan',
    'Storm Titan',
    'Thunder-plated armor — pairs with the Storm Bear companion.',
    'skin',
    'epic',
    950
  ),
  (
    'nebula-ronin',
    'Nebula Ronin',
    'Star-forged duelist — pairs with the Star Dragon companion.',
    'skin',
    'epic',
    1100
  ),
  (
    'blood-moon',
    'Blood Moon',
    'Crimson lunar cultist — pairs with the Rune Raven companion.',
    'skin',
    'rare',
    550
  ),
  (
    'aurora-sage',
    'Aurora Sage',
    'Northern lights seer — pairs with the Moon Owl companion.',
    'skin',
    'rare',
    480
  )
on conflict (slug) do nothing;

-- Grant new themes to allowlisted locker accounts only.
insert into public.user_inventory (user_id, item_id)
select u.id, si.id
from auth.users u
cross join public.shop_items si
left join public.profiles p on p.id = u.id
where si.kind in ('skin', 'badge')
  and si.slug in ('frost-walker', 'storm-titan', 'nebula-ronin', 'blood-moon', 'aurora-sage')
  and (
    lower(u.email) = 'test3@example.com'
    or lower(coalesce(p.username, '')) = 'kbab'
    or lower(u.email) like '%kbab%'
    or lower(replace(coalesce(p.display_name, ''), ' ', '')) = 'cool$guy1'
  )
on conflict (user_id, item_id) do nothing;
