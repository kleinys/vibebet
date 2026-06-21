-- =============================================================================
-- Phase 27: Live events (watch + bet) + duel detail RPC
-- =============================================================================

create table if not exists public.live_events (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references auth.users(id) on delete cascade,
  title               text not null check (char_length(title) between 3 and 200),
  description         text,
  category            text not null default 'other'
    check (category in ('sports', 'poker', 'chess', 'esports', 'other')),
  stream_url          text,
  status              text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended')),
  betting_market_id   uuid references public.markets(id) on delete set null,
  duel_id             uuid references public.duels(id) on delete set null,
  paper_duel_id       uuid,  -- optional link to paper_duels (phase 23); no FK so phase 27 applies standalone
  starts_at           timestamptz,
  ends_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists live_events_status_starts_idx
  on public.live_events (status, starts_at desc nulls last);

create index if not exists live_events_creator_idx
  on public.live_events (creator_id, created_at desc);

alter table public.live_events enable row level security;

drop policy if exists live_events_select on public.live_events;
create policy live_events_select on public.live_events
  for select to authenticated, anon
  using (status in ('scheduled', 'live', 'ended'));

drop policy if exists live_events_insert on public.live_events;
create policy live_events_insert on public.live_events
  for insert to authenticated
  with check (creator_id = auth.uid());

drop policy if exists live_events_update on public.live_events;
create policy live_events_update on public.live_events
  for update to authenticated
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Create a live event with optional spectator betting market
-- ---------------------------------------------------------------------------
create or replace function public.create_live_event(
  p_title        text,
  p_description  text default null,
  p_category     text default 'other',
  p_stream_url   text default null,
  p_starts_at    timestamptz default null,
  p_yes_label    text default 'Side A',
  p_no_label     text default 'Side B',
  p_enable_bet   boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_event_id  uuid;
  v_market_id uuid;
  v_closes    timestamptz;
  v_question  text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_title is null or length(trim(p_title)) < 3 then raise exception 'title too short'; end if;

  v_closes := coalesce(p_starts_at, now()) + interval '24 hours';
  v_question := left(trim(p_title), 240);

  insert into public.live_events (
    creator_id, title, description, category, stream_url, status, starts_at, ends_at
  ) values (
    v_user_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(nullif(trim(p_category), ''), 'other'),
    nullif(trim(coalesce(p_stream_url, '')), ''),
    case when p_starts_at is not null and p_starts_at > now() then 'scheduled' else 'live' end,
    p_starts_at,
    v_closes
  ) returning id into v_event_id;

  if p_enable_bet then
    v_market_id := public._create_platform_market(
      v_user_id,
      v_question,
      format(
        'Spectator market for live event %s. Creator resolves when the match ends. '
        'Play-money VIBE only — link your stream and let viewers bet alongside.',
        v_event_id
      ),
      3000,
      0.5,
      v_closes,
      'other'::public.market_category,
      coalesce(nullif(trim(p_yes_label), ''), 'Side A'),
      coalesce(nullif(trim(p_no_label), ''), 'Side B'),
      'community'::public.market_source,
      false,
      null, null, null, null, null
    );

    update public.live_events
       set betting_market_id = v_market_id
     where id = v_event_id;
  end if;

  return v_event_id;
end;
$$;

revoke execute on function public.create_live_event(text, text, text, text, timestamptz, text, text, boolean) from public;
grant  execute on function public.create_live_event(text, text, text, text, timestamptz, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.set_live_event_status(
  p_event_id uuid,
  p_status   text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_status not in ('scheduled', 'live', 'ended') then raise exception 'invalid status'; end if;

  update public.live_events
     set status = p_status,
         updated_at = now(),
         ends_at = case when p_status = 'ended' then now() else ends_at end
   where id = p_event_id and creator_id = v_user_id;

  if not found then raise exception 'event not found or not yours'; end if;
end;
$$;

revoke execute on function public.set_live_event_status(uuid, text) from public;
grant  execute on function public.set_live_event_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.get_live_events(p_limit int default 30)
returns table (
  id                  uuid,
  creator_id          uuid,
  creator_name        text,
  title               text,
  description         text,
  category            text,
  stream_url          text,
  status              text,
  betting_market_id   uuid,
  duel_id             uuid,
  paper_duel_id       uuid,
  starts_at           timestamptz,
  ends_at             timestamptz,
  created_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.creator_id,
    coalesce(p.display_name, 'Host') as creator_name,
    e.title,
    e.description,
    e.category,
    e.stream_url,
    e.status,
    e.betting_market_id,
    e.duel_id,
    e.paper_duel_id,
    e.starts_at,
    e.ends_at,
    e.created_at
  from public.live_events e
  left join public.profiles p on p.id = e.creator_id
  where e.status in ('scheduled', 'live')
  order by
    case e.status when 'live' then 0 else 1 end,
    e.starts_at nulls last,
    e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke execute on function public.get_live_events(int) from public;
grant  execute on function public.get_live_events(int) to authenticated, anon;

-- ---------------------------------------------------------------------------
create or replace function public.get_live_event(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select
    e.id,
    e.creator_id,
    coalesce(p.display_name, 'Host') as creator_name,
    e.title,
    e.description,
    e.category,
    e.stream_url,
    e.status,
    e.betting_market_id,
    e.duel_id,
    e.paper_duel_id,
    e.starts_at,
    e.ends_at,
    e.created_at
  into v_row
  from public.live_events e
  left join public.profiles p on p.id = e.creator_id
  where e.id = p_event_id;

  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_row.id,
    'creator_id', v_row.creator_id,
    'creator_name', v_row.creator_name,
    'title', v_row.title,
    'description', v_row.description,
    'category', v_row.category,
    'stream_url', v_row.stream_url,
    'status', v_row.status,
    'betting_market_id', v_row.betting_market_id,
    'duel_id', v_row.duel_id,
    'paper_duel_id', v_row.paper_duel_id,
    'starts_at', v_row.starts_at,
    'ends_at', v_row.ends_at,
    'created_at', v_row.created_at
  );
end;
$$;

revoke execute on function public.get_live_event(uuid) from public;
grant  execute on function public.get_live_event(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Link an existing duel or paper race to a live event (host only)
-- ---------------------------------------------------------------------------
create or replace function public.link_live_event_game(
  p_event_id      uuid,
  p_duel_id       uuid default null,
  p_paper_duel_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_duel_id is null and p_paper_duel_id is null then
    raise exception 'provide duel_id or paper_duel_id';
  end if;

  if p_duel_id is not null then
    if not exists (
      select 1 from public.duels d
       where d.id = p_duel_id
         and (d.challenger_id = v_user_id or d.opponent_id = v_user_id)
    ) then
      raise exception 'duel not found or not yours';
    end if;
  end if;

  if p_paper_duel_id is not null then
    if to_regclass('public.paper_duels') is null then
      raise exception 'return races not available — apply phase 23 migration first';
    end if;
    if not exists (
      select 1 from public.paper_duels d
       where d.id = p_paper_duel_id
         and (d.creator_id = v_user_id or d.opponent_id = v_user_id)
    ) then
      raise exception 'paper duel not found or not yours';
    end if;
  end if;

  update public.live_events
     set duel_id = coalesce(p_duel_id, duel_id),
         paper_duel_id = coalesce(p_paper_duel_id, paper_duel_id),
         updated_at = now()
   where id = p_event_id and creator_id = v_user_id;

  if not found then raise exception 'event not found or not yours'; end if;
end;
$$;

revoke execute on function public.link_live_event_game(uuid, uuid, uuid) from public;
grant  execute on function public.link_live_event_game(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Single prediction duel for watch pages (spectators + participants)
-- ---------------------------------------------------------------------------
create or replace function public.get_duel(p_duel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duel public.duels%rowtype;
  v_market public.markets%rowtype;
  v_spec public.markets%rowtype;
  v_challenger text;
  v_opponent text;
begin
  select * into v_duel from public.duels where id = p_duel_id;
  if not found then return null; end if;

  if v_duel.status not in ('accepted', 'settled')
     and v_duel.challenger_id is distinct from auth.uid()
     and v_duel.opponent_id is distinct from auth.uid()
     and not (v_duel.status = 'pending' and v_duel.opponent_id is null) then
    return null;
  end if;

  select * into v_market from public.markets where id = v_duel.market_id;
  select coalesce(display_name, 'Challenger') into v_challenger
    from public.profiles where id = v_duel.challenger_id;
  select coalesce(display_name, 'Open') into v_opponent
    from public.profiles where id = v_duel.opponent_id;

  if v_duel.spectator_market_id is not null then
    select * into v_spec from public.markets where id = v_duel.spectator_market_id;
  end if;

  return jsonb_build_object(
    'id', v_duel.id,
    'status', v_duel.status,
    'challenger_id', v_duel.challenger_id,
    'challenger_name', v_challenger,
    'opponent_id', v_duel.opponent_id,
    'opponent_name', v_opponent,
    'challenger_side', v_duel.challenger_side,
    'opponent_side', v_duel.opponent_side,
    'stake', v_duel.stake,
    'market_id', v_duel.market_id,
    'market_question', v_market.question,
    'market_status', v_market.status,
    'spectator_market_id', v_duel.spectator_market_id,
    'spectator_reserve_yes', v_spec.reserve_yes,
    'spectator_reserve_no', v_spec.reserve_no,
    'spectator_yes_label', v_spec.outcome_yes_label,
    'spectator_no_label', v_spec.outcome_no_label,
    'spectator_status', v_spec.status,
    'accepted_at', v_duel.accepted_at,
    'expires_at', v_duel.expires_at,
    'created_at', v_duel.created_at
  );
end;
$$;

revoke execute on function public.get_duel(uuid) from public;
grant  execute on function public.get_duel(uuid) to authenticated, anon;

insert into public.feature_flags (key, enabled, description)
values (
  'live_events_enabled',
  false,
  'Live watch hub: stream embeds (YouTube/Twitch) + spectator betting markets for sports, poker, chess, etc.'
)
on conflict (key) do update set description = excluded.description;
