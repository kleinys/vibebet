-- Guild team pot — members contribute VIBE toward the shared weekly quest goal
alter table public.guilds
  add column if not exists weekly_pot bigint not null default 0 check (weekly_pot >= 0),
  add column if not exists pot_week_start date not null default (date_trunc('week', now())::date);

create table if not exists public.guild_pot_contributions (
  id          uuid primary key default gen_random_uuid(),
  guild_id    uuid not null references public.guilds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  week_start  date not null,
  created_at  timestamptz not null default now()
);

create index if not exists guild_pot_contributions_guild_week_idx
  on public.guild_pot_contributions (guild_id, week_start desc);

alter table public.guild_pot_contributions enable row level security;

drop policy if exists guild_pot_contributions_select on public.guild_pot_contributions;
create policy guild_pot_contributions_select on public.guild_pot_contributions
  for select to authenticated using (true);

create or replace function public.contribute_to_guild_pot(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_guild_id uuid;
  v_week     date := public._week_start(now());
  v_enabled  boolean := false;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_amount is null or p_amount < 10 or p_amount > 50000 then
    raise exception 'contribution must be between 10 and 50000 VIBE';
  end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'guild_weekly_quest_enabled'),
    false
  ) into v_enabled;
  if not v_enabled then raise exception 'guild weekly quest is disabled'; end if;

  select gm.guild_id into v_guild_id
    from public.guild_members gm
   where gm.user_id = v_user_id;
  if v_guild_id is null then raise exception 'join a guild first'; end if;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    p_amount,
    'guild_pot_contribution',
    'guild_pot:' || v_guild_id::text || ':' || v_user_id::text || ':' || extract(epoch from now())::bigint::text,
    'guild_pot:' || v_guild_id::text,
    jsonb_build_object('guild_id', v_guild_id, 'week_start', v_week)
  );

  update public.guilds g
     set weekly_pot = case
           when g.pot_week_start = v_week then g.weekly_pot + p_amount
           else p_amount
         end,
         pot_week_start = v_week,
         weekly_volume = case
           when g.volume_week_start = v_week then g.weekly_volume + p_amount
           else p_amount
         end,
         volume_week_start = v_week,
         total_volume = g.total_volume + p_amount
   where g.id = v_guild_id;

  insert into public.guild_pot_contributions (guild_id, user_id, amount, week_start)
  values (v_guild_id, v_user_id, p_amount, v_week);

  return jsonb_build_object('ok', true, 'amount', p_amount);
end;
$$;

revoke execute on function public.contribute_to_guild_pot(bigint) from public;
grant execute on function public.contribute_to_guild_pot(bigint) to authenticated;

create or replace function public.get_guild_quest_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id   uuid := auth.uid();
  v_guild_id  uuid;
  v_week      date := public._week_start(now());
  v_volume    bigint := 0;
  v_pot       bigint := 0;
  v_target    bigint := 50000;
  v_reward    bigint := 250;
  v_claimed   boolean := false;
  v_enabled   boolean := false;
  v_combined  bigint := 0;
begin
  if v_user_id is null then return jsonb_build_object('skipped', true); end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'guild_weekly_quest_enabled'),
    false
  ) into v_enabled;

  if not v_enabled then
    return jsonb_build_object('enabled', false);
  end if;

  select gm.guild_id into v_guild_id
    from public.guild_members gm
   where gm.user_id = v_user_id;

  if v_guild_id is null then
    return jsonb_build_object('enabled', true, 'in_guild', false);
  end if;

  select
    case when g.volume_week_start = v_week then g.weekly_volume else 0 end,
    case when g.pot_week_start = v_week then g.weekly_pot else 0 end
    into v_volume, v_pot
    from public.guilds g
   where g.id = v_guild_id;

  v_combined := coalesce(v_volume, 0);

  select exists(
    select 1 from public.guild_weekly_quest_claims c
     where c.guild_id = v_guild_id
       and c.user_id = v_user_id
       and c.week_start = v_week
  ) into v_claimed;

  return jsonb_build_object(
    'enabled', true,
    'in_guild', true,
    'week_start', v_week,
    'target_volume', v_target,
    'current_volume', v_combined,
    'pot_contributed', coalesce(v_pot, 0),
    'completed', v_combined >= v_target,
    'claimed', v_claimed,
    'reward_vibe', v_reward
  );
end;
$$;

revoke execute on function public.get_guild_quest_status() from public;
grant execute on function public.get_guild_quest_status() to authenticated;
