-- =============================================================================
-- Phase 12: Guilds — team up, compete on weekly wager volume
-- =============================================================================

create table if not exists public.guilds (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(trim(name)) between 3 and 40),
  slug               text not null unique,
  tag                text not null unique
    check (tag ~ '^[A-Z0-9]{2,5}$'),
  description        text,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  member_count       int not null default 1 check (member_count >= 1),
  weekly_volume      bigint not null default 0 check (weekly_volume >= 0),
  volume_week_start  date not null default (date_trunc('week', now())::date),
  total_volume       bigint not null default 0 check (total_volume >= 0),
  created_at         timestamptz not null default now()
);

create table if not exists public.guild_members (
  guild_id    uuid not null references public.guilds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create unique index if not exists guild_members_one_guild_per_user
  on public.guild_members (user_id);

create index if not exists guilds_weekly_volume_idx
  on public.guilds (weekly_volume desc);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;

drop policy if exists guilds_select on public.guilds;
create policy guilds_select on public.guilds
  for select to authenticated, anon using (true);

drop policy if exists guild_members_select on public.guild_members;
create policy guild_members_select on public.guild_members
  for select to authenticated, anon using (true);

-- ---------------------------------------------------------------------------
-- Volume bump (called on every trade)
-- ---------------------------------------------------------------------------
create or replace function public._bump_guild_volume(
  p_user_id uuid,
  p_amount  bigint
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guild_id uuid;
  v_week     date := public._week_start(now());
begin
  if p_user_id is null or p_amount <= 0 then return; end if;

  select gm.guild_id into v_guild_id
    from public.guild_members gm
   where gm.user_id = p_user_id;

  if v_guild_id is null then return; end if;

  update public.guilds g
     set weekly_volume = case
           when g.volume_week_start = v_week then g.weekly_volume + p_amount
           else p_amount
         end,
         volume_week_start = v_week,
         total_volume = g.total_volume + p_amount
   where g.id = v_guild_id;
end;
$$;

revoke execute on function public._bump_guild_volume(uuid, bigint) from public;

create or replace function public._guild_volume_on_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.side is not null then
    perform public._bump_guild_volume(new.user_id, abs(new.cost));
  end if;
  return new;
end;
$$;

drop trigger if exists guild_volume_on_trade on public.trades;
create trigger guild_volume_on_trade
  after insert on public.trades
  for each row execute function public._guild_volume_on_trade();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public._slugify_guild_name(p_name text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'),
    40
  );
$$;

create or replace function public.create_guild(
  p_name        text,
  p_tag         text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slug    text;
  v_tag     text;
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if exists (select 1 from public.guild_members where user_id = v_user_id) then
    raise exception 'already in a guild — leave first';
  end if;

  v_tag := upper(trim(p_tag));
  if v_tag !~ '^[A-Z0-9]{2,5}$' then
    raise exception 'tag must be 2–5 letters/numbers';
  end if;

  v_slug := public._slugify_guild_name(p_name);
  if length(v_slug) < 3 then
    v_slug := v_slug || '-guild';
  end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.guilds (name, slug, tag, description, owner_id)
  values (
    trim(p_name),
    v_slug,
    v_tag,
    nullif(trim(p_description), ''),
    v_user_id
  )
  returning id into v_guild_id;

  insert into public.guild_members (guild_id, user_id, role)
  values (v_guild_id, v_user_id, 'owner');

  return v_guild_id;
end;
$$;

revoke execute on function public.create_guild(text, text, text) from public;
grant  execute on function public.create_guild(text, text, text) to authenticated;

create or replace function public.join_guild(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_guild_id uuid;
  v_count    int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if exists (select 1 from public.guild_members where user_id = v_user_id) then
    raise exception 'already in a guild';
  end if;

  select id, member_count into v_guild_id, v_count
    from public.guilds where slug = trim(p_slug);
  if v_guild_id is null then raise exception 'guild not found'; end if;
  if v_count >= 100 then raise exception 'guild is full'; end if;

  insert into public.guild_members (guild_id, user_id, role)
  values (v_guild_id, v_user_id, 'member');

  update public.guilds
     set member_count = member_count + 1
   where id = v_guild_id;

  perform public.check_achievements(v_user_id);

  return v_guild_id;
end;
$$;

revoke execute on function public.join_guild(text) from public;
grant  execute on function public.join_guild(text) to authenticated;

create or replace function public.leave_guild()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_guild_id uuid;
  v_role     text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select guild_id, role into v_guild_id, v_role
    from public.guild_members where user_id = v_user_id;
  if v_guild_id is null then raise exception 'not in a guild'; end if;
  if v_role = 'owner' then
    raise exception 'owners must disband the guild instead of leaving';
  end if;

  delete from public.guild_members
   where guild_id = v_guild_id and user_id = v_user_id;

  update public.guilds
     set member_count = greatest(1, member_count - 1)
   where id = v_guild_id;
end;
$$;

revoke execute on function public.leave_guild() from public;
grant  execute on function public.leave_guild() to authenticated;

create or replace function public.disband_guild()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_guild_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select g.id into v_guild_id
    from public.guilds g
   where g.owner_id = v_user_id;
  if v_guild_id is null then raise exception 'you do not own a guild'; end if;

  delete from public.guilds where id = v_guild_id;
end;
$$;

revoke execute on function public.disband_guild() from public;
grant  execute on function public.disband_guild() to authenticated;

create or replace function public.get_my_guild()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_result  jsonb;
begin
  if v_user_id is null then return '{}'::jsonb; end if;

  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'slug', g.slug,
    'tag', g.tag,
    'description', g.description,
    'member_count', g.member_count,
    'weekly_volume', g.weekly_volume,
    'total_volume', g.total_volume,
    'role', gm.role,
    'owner_id', g.owner_id
  ) into v_result
    from public.guild_members gm
    join public.guilds g on g.id = gm.guild_id
   where gm.user_id = v_user_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke execute on function public.get_my_guild() from public;
grant  execute on function public.get_my_guild() to authenticated;

create or replace function public.get_guild_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_guild public.guilds%rowtype;
begin
  select * into v_guild from public.guilds where slug = trim(p_slug);
  if not found then return '{}'::jsonb; end if;

  return jsonb_build_object(
    'id', v_guild.id,
    'name', v_guild.name,
    'slug', v_guild.slug,
    'tag', v_guild.tag,
    'description', v_guild.description,
    'member_count', v_guild.member_count,
    'weekly_volume', v_guild.weekly_volume,
    'total_volume', v_guild.total_volume,
    'owner_id', v_guild.owner_id,
    'created_at', v_guild.created_at
  );
end;
$$;

revoke execute on function public.get_guild_by_slug(text) from public;
grant  execute on function public.get_guild_by_slug(text) to authenticated, anon;

create or replace function public.guild_leaderboard(p_limit int default 25)
returns table (
  rank           int,
  guild_id       uuid,
  name           text,
  slug           text,
  tag            text,
  member_count   int,
  weekly_volume  bigint,
  total_volume   bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    row_number() over (order by g.weekly_volume desc)::int,
    g.id,
    g.name,
    g.slug,
    g.tag,
    g.member_count,
    g.weekly_volume,
    g.total_volume
  from public.guilds g
  order by g.weekly_volume desc, g.total_volume desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.guild_leaderboard(int) from public;
grant  execute on function public.guild_leaderboard(int) to authenticated, anon;

create or replace function public.list_guild_members(
  p_guild_id uuid,
  p_limit    int default 50
)
returns table (
  user_id       uuid,
  display_name  text,
  role          text,
  joined_at     timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    gm.user_id,
    coalesce(p.display_name, 'Anonymous'),
    gm.role,
    gm.joined_at
  from public.guild_members gm
  left join public.profiles p on p.id = gm.user_id
  where gm.guild_id = p_guild_id
  order by
    case gm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    gm.joined_at
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.list_guild_members(uuid, int) from public;
grant  execute on function public.list_guild_members(uuid, int) to authenticated, anon;

-- Guild achievements in check_achievements
create or replace function public.check_achievements(p_user_id uuid default auth.uid())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count      int := 0;
  v_streak     int;
  v_trades     int;
  v_markets    int;
  v_comments   int;
  v_scored     int;
  v_correct    int;
  v_accuracy   numeric;
  v_duel_wins  int;
  v_in_guild   boolean;
begin
  if p_user_id is null then return 0; end if;

  select current_streak, predictions_scored, correct_predictions
    into v_streak, v_scored, v_correct
    from public.profiles where id = p_user_id;

  select count(*)::int into v_trades from public.trades where user_id = p_user_id;
  select count(*)::int into v_markets from public.markets where creator_id = p_user_id;
  select count(*)::int into v_comments from public.market_comments where user_id = p_user_id;
  select count(*)::int into v_duel_wins from public.duels
   where winner_id = p_user_id and status = 'settled';
  select exists(select 1 from public.guild_members where user_id = p_user_id)
    into v_in_guild;

  if v_trades >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_trade') on conflict do nothing;
  end if;
  if v_markets >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_market') on conflict do nothing;
  end if;
  if v_comments >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_comment') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 3 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_3') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 7 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_7') on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 30 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_30') on conflict do nothing;
  end if;
  if (select coalesce(sum(abs(cost)), 0) from public.trades where user_id = p_user_id) >= 1000 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'volume_1k') on conflict do nothing;
  end if;

  if coalesce(v_scored, 0) >= 10 then
    v_accuracy := v_correct::numeric / v_scored;
    if v_accuracy >= 0.55 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_oracle') on conflict do nothing;
    end if;
    if v_scored >= 50 and v_accuracy >= 0.65 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_prophet') on conflict do nothing;
    end if;
    if v_scored >= 100 and v_accuracy >= 0.75 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'accuracy_legend') on conflict do nothing;
    end if;
  end if;

  if v_duel_wins >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'duel_first_win') on conflict do nothing;
  end if;
  if v_duel_wins >= 5 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'duel_wins_5') on conflict do nothing;
  end if;

  if v_in_guild then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'guild_member') on conflict do nothing;
  end if;

  return v_count;
end;
$$;

insert into public.feature_flags (key, enabled, description)
values ('guilds_enabled', false, 'Guild teams with weekly volume leaderboard')
on conflict (key) do update set description = excluded.description;
