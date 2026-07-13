-- Phase 56: Platform Apps store (v1) + Arena Raid communal event

-- ---------------------------------------------------------------------------
-- Platform modules (curated extensions — user creation deferred)
-- ---------------------------------------------------------------------------

create table if not exists public.platform_modules (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text not null,
  kind          text not null check (kind in ('duel', 'hustle', 'market', 'arcade', 'watch')),
  target_href   text not null,
  icon_emoji    text not null default '✨',
  install_count bigint not null default 0 check (install_count >= 0),
  creator_id    uuid references public.profiles(id) on delete set null,
  status        text not null default 'published'
    check (status in ('draft', 'published', 'hidden')),
  created_at    timestamptz not null default now()
);

create index if not exists platform_modules_status_idx
  on public.platform_modules (status, install_count desc);

alter table public.platform_modules enable row level security;

drop policy if exists platform_modules_select on public.platform_modules;
create policy platform_modules_select on public.platform_modules
  for select to authenticated, anon
  using (status = 'published');

create table if not exists public.user_module_installs (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  module_id    uuid not null references public.platform_modules(id) on delete cascade,
  installed_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table public.user_module_installs enable row level security;

drop policy if exists user_module_installs_select on public.user_module_installs;
create policy user_module_installs_select on public.user_module_installs
  for select to authenticated
  using (user_id = auth.uid());

-- Seed curated platform modules
insert into public.platform_modules (slug, name, description, kind, target_href, icon_emoji, install_count)
values
  (
    'lightning-oracle',
    'Lightning Oracle',
    '60-second BTC up/down duels with live strike prices. Fast oracle clashes for competitors.',
    'duel',
    '/play?tab=duels',
    '⚡',
    128
  ),
  (
    'lucky-slots-pack',
    'Lucky Slots Pack',
    'Reels + scratchers in the Arcade. High-drama spins with scratcher side quests.',
    'arcade',
    '/play?tab=arcade',
    '🎰',
    94
  ),
  (
    'gig-scout',
    'Gig Scout',
    'Browse and claim HustleOS gigs. Earn VIBE from micro-work and grow trust tier.',
    'hustle',
    '/hustle',
    '📋',
    76
  ),
  (
    'spectator-lounge',
    'Spectator Lounge',
    'Watch live streams and bet on active duel spectator markets.',
    'watch',
    '/play?tab=watch',
    '📺',
    112
  ),
  (
    'fast-windows',
    'Fast Windows',
    'Crypto and equity up/down windows with countdown timers.',
    'market',
    '/play?tab=live',
    '📈',
    88
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  target_href = excluded.target_href,
  icon_emoji = excluded.icon_emoji;

-- ---------------------------------------------------------------------------
-- Module RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_platform_modules(p_limit int default 24)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'slug', m.slug,
        'name', m.name,
        'description', m.description,
        'kind', m.kind,
        'target_href', m.target_href,
        'icon_emoji', m.icon_emoji,
        'install_count', m.install_count,
        'installed', exists (
          select 1 from public.user_module_installs i
          where i.module_id = m.id and i.user_id = auth.uid()
        )
      )
      order by m.install_count desc, m.name
    ),
    '[]'::jsonb
  )
  from (
    select * from public.platform_modules
    where status = 'published'
    order by install_count desc, name
    limit greatest(1, least(p_limit, 50))
  ) m;
$$;

revoke all on function public.list_platform_modules(int) from public;
grant execute on function public.list_platform_modules(int) to authenticated, anon;

create or replace function public.get_platform_module(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'slug', m.slug,
    'name', m.name,
    'description', m.description,
    'kind', m.kind,
    'target_href', m.target_href,
    'icon_emoji', m.icon_emoji,
    'install_count', m.install_count,
    'installed', exists (
      select 1 from public.user_module_installs i
      where i.module_id = m.id and i.user_id = auth.uid()
    )
  )
  from public.platform_modules m
  where m.slug = p_slug and m.status = 'published';
$$;

revoke all on function public.get_platform_module(text) from public;
grant execute on function public.get_platform_module(text) to authenticated, anon;

create or replace function public.install_platform_module(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_module public.platform_modules%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_module from public.platform_modules
  where slug = p_slug and status = 'published';
  if not found then raise exception 'module not found'; end if;

  insert into public.user_module_installs (user_id, module_id)
  values (v_user_id, v_module.id)
  on conflict do nothing;

  if found then
    update public.platform_modules
    set install_count = install_count + 1
    where id = v_module.id;
  end if;

  perform public.track_event('module_installed', jsonb_build_object(
    'slug', v_module.slug,
    'kind', v_module.kind
  ));

  return public.get_platform_module(p_slug);
end;
$$;

revoke all on function public.install_platform_module(text) from public;
grant execute on function public.install_platform_module(text) to authenticated;

create or replace function public.get_my_installed_modules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', m.slug,
        'name', m.name,
        'kind', m.kind,
        'target_href', m.target_href,
        'icon_emoji', m.icon_emoji,
        'installed_at', i.installed_at
      )
      order by i.installed_at desc
    ),
    '[]'::jsonb
  )
  from public.user_module_installs i
  join public.platform_modules m on m.id = i.module_id
  where i.user_id = auth.uid() and m.status = 'published';
$$;

revoke all on function public.get_my_installed_modules() from public;
grant execute on function public.get_my_installed_modules() to authenticated;

-- Cathedral: add apps library wing + bump max to 9
create or replace function public.get_legacy_cathedral(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_profile public.profiles%rowtype;
  v_elements jsonb := '[]'::jsonb;
  v_count int := 0;
  v_first_bet boolean := false;
  v_duel boolean := false;
  v_wheel boolean := false;
  v_hustle_claim boolean := false;
  v_pass_complete boolean := false;
  v_module_install boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('visible', false);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    return jsonb_build_object('visible', false);
  end if;

  v_elements := v_elements || jsonb_build_object(
    'id', 'foundation', 'label', 'Foundation', 'done', true
  );
  v_count := v_count + 1;

  select exists (
    select 1 from public.onboarding_progress o
    where o.user_id = v_user_id and o.first_bet_at is not null
  )
  or exists (
    select 1 from public.trades t where t.user_id = v_user_id and t.cost > 0 limit 1
  )
  into v_first_bet;

  if v_first_bet then
    v_elements := v_elements || jsonb_build_object(
      'id', 'market_wing', 'label', 'Market wing', 'done', true
    );
    v_count := v_count + 1;
  end if;

  v_duel := public._user_has_finished_duel(v_user_id);
  if v_duel then
    v_elements := v_elements || jsonb_build_object(
      'id', 'duel_tower', 'label', 'Duel tower', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select exists (
    select 1 from public.user_daily_hustle_progress h
    where h.user_id = v_user_id and h.claimed_at is not null limit 1
  )
  into v_hustle_claim;

  if v_hustle_claim then
    v_elements := v_elements || jsonb_build_object(
      'id', 'hustle_hall', 'label', 'Hustle hall', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select exists (
    select 1 from public.locker_wheel_daily w
    where w.user_id = v_user_id and w.spins_used > 0
  )
  into v_wheel;

  if v_wheel then
    v_elements := v_elements || jsonb_build_object(
      'id', 'arcade_dome', 'label', 'Arcade dome', 'done', true
    );
    v_count := v_count + 1;
  end if;

  if v_profile.current_streak >= 7 then
    v_elements := v_elements || jsonb_build_object(
      'id', 'streak_beacon', 'label', 'Streak beacon', 'done', true
    );
    v_count := v_count + 1;
  end if;

  if coalesce(v_profile.hustle_tier, 1) >= 3 then
    v_elements := v_elements || jsonb_build_object(
      'id', 'trust_spire', 'label', 'Trust spire', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select exists (
    select 1 from public.user_module_installs where user_id = v_user_id limit 1
  )
  into v_module_install;

  if v_module_install then
    v_elements := v_elements || jsonb_build_object(
      'id', 'apps_library', 'label', 'Apps library', 'done', true
    );
    v_count := v_count + 1;
  end if;

  select (
    1
    + case when v_first_bet then 1 else 0 end
    + case when v_duel then 1 else 0 end
    + case when v_wheel then 1 else 0 end
  ) >= 4
  into v_pass_complete;

  if v_pass_complete then
    v_elements := v_elements || jsonb_build_object(
      'id', 'crown', 'label', 'Vibe Pass crown', 'done', true
    );
    v_count := v_count + 1;
  end if;

  return jsonb_build_object(
    'visible', true,
    'wings', v_count,
    'max_wings', 9,
    'percent', least(100, round(100.0 * v_count / 9.0)),
    'display_name', coalesce(v_profile.display_name, 'Player'),
    'companion_name', v_profile.companion_name,
    'public_slug', coalesce(v_profile.username, v_user_id::text),
    'elements', v_elements
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Arena Raid — communal Watch/Arcade event (fills at 5 players)
-- ---------------------------------------------------------------------------

create table if not exists public.arena_raids (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'open'
    check (status in ('open', 'filled', 'settled')),
  participant_cap int not null default 5,
  reward_per_user bigint not null default 25,
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);

create table if not exists public.arena_raid_entries (
  raid_id   uuid not null references public.arena_raids(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (raid_id, user_id)
);

alter table public.arena_raids enable row level security;
alter table public.arena_raid_entries enable row level security;

drop policy if exists arena_raids_select on public.arena_raids;
create policy arena_raids_select on public.arena_raids
  for select to authenticated
  using (true);

drop policy if exists arena_raid_entries_select on public.arena_raid_entries;
create policy arena_raid_entries_select on public.arena_raid_entries
  for select to authenticated
  using (true);

create or replace function public.get_active_arena_raid()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_raid public.arena_raids%rowtype;
  v_count int;
  v_joined boolean := false;
begin
  select * into v_raid from public.arena_raids
  where status in ('open', 'filled')
  order by created_at desc
  limit 1;

  if not found then
    insert into public.arena_raids (status) values ('open')
    returning * into v_raid;
  end if;

  select count(*)::int into v_count
  from public.arena_raid_entries where raid_id = v_raid.id;

  if auth.uid() is not null then
    select exists (
      select 1 from public.arena_raid_entries
      where raid_id = v_raid.id and user_id = auth.uid()
    ) into v_joined;
  end if;

  return jsonb_build_object(
    'raid_id', v_raid.id,
    'status', v_raid.status,
    'participant_count', v_count,
    'participant_cap', v_raid.participant_cap,
    'reward_per_user', v_raid.reward_per_user,
    'joined', v_joined
  );
end;
$$;

revoke all on function public.get_active_arena_raid() from public;
grant execute on function public.get_active_arena_raid() to authenticated, anon;

create or replace function public.join_arena_raid()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_raid public.arena_raids%rowtype;
  v_count int;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_ref text;
  v_uid uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_raid from public.arena_raids
  where status = 'open'
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.arena_raids (status) values ('open')
    returning * into v_raid;
  end if;

  if v_raid.status <> 'open' then
    raise exception 'raid already filled';
  end if;

  insert into public.arena_raid_entries (raid_id, user_id)
  values (v_raid.id, v_user_id)
  on conflict do nothing;

  select count(*)::int into v_count
  from public.arena_raid_entries where raid_id = v_raid.id;

  if v_count < v_raid.participant_cap then
    return jsonb_build_object(
      'joined', true,
      'participant_count', v_count,
      'participant_cap', v_raid.participant_cap,
      'settled', false
    );
  end if;

  update public.arena_raids
  set status = 'settled', settled_at = now()
  where id = v_raid.id;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  for v_uid in
    select user_id from public.arena_raid_entries where raid_id = v_raid.id
  loop
    select public._wallet_for_user(v_uid) into v_wallet;
    if v_wallet is null then continue; end if;

    v_ref := 'arena_raid:' || v_raid.id::text || ':' || v_uid::text;

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'arena_raid',
      v_ref,
      jsonb_build_object('raid_id', v_raid.id, 'reward', v_raid.reward_per_user),
      v_uid
    )
    on conflict (external_ref) do nothing
    returning id into v_tx_id;

    if v_tx_id is not null then
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_wallet, v_raid.reward_per_user, 'vibe'),
        (v_tx_id, v_mint, -v_raid.reward_per_user, 'vibe');
    end if;
  end loop;

  insert into public.arena_raids (status) values ('open');

  perform public.track_event('arena_raid_settled', jsonb_build_object(
    'raid_id', v_raid.id,
    'participants', v_count
  ));

  return jsonb_build_object(
    'joined', true,
    'participant_count', v_count,
    'participant_cap', v_raid.participant_cap,
    'settled', true,
    'reward_per_user', v_raid.reward_per_user
  );
end;
$$;

revoke all on function public.join_arena_raid() from public;
grant execute on function public.join_arena_raid() to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('user_modules_enabled', true, 'Platform Apps store at /apps — browse and install curated modules'),
  ('module_creation_enabled', false, 'User-submitted modules — moderation required, keep off until Phase 4.2'),
  ('arena_raid_enabled', true, 'Communal arena raid events on Watch tab')
on conflict (key) do update set description = excluded.description;
