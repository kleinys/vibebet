-- =============================================================================
-- Phase 5: Daily streaks + achievements
-- =============================================================================

alter table public.profiles
  add column if not exists current_streak   int  not null default 0
    check (current_streak >= 0),
  add column if not exists longest_streak   int  not null default 0
    check (longest_streak >= 0),
  add column if not exists last_active_date date;

create table if not exists public.user_achievements (
  user_id         uuid not null references auth.users(id) on delete cascade,
  achievement_id  text not null,
  unlocked_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy user_achievements_select_own on public.user_achievements
  for select to authenticated using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RPC: record_daily_activity
--   Call on page loads while signed in. Updates login streak once per UTC day.
-- -----------------------------------------------------------------------------
create or replace function public.record_daily_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date := (now() at time zone 'utc')::date;
  v_profile   public.profiles%rowtype;
  v_streak    int;
begin
  if v_user_id is null then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then return jsonb_build_object('skipped', true); end if;

  if v_profile.last_active_date = v_today then
    return jsonb_build_object(
      'current_streak', v_profile.current_streak,
      'already_recorded', true
    );
  end if;

  if v_profile.last_active_date = v_today - 1 then
    v_streak := v_profile.current_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
     set current_streak   = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_active_date = v_today,
         updated_at       = now()
   where id = v_user_id;

  perform public.check_achievements(v_user_id);

  return jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', greatest(v_profile.longest_streak, v_streak),
    'already_recorded', false
  );
end;
$$;

revoke execute on function public.record_daily_activity() from public;
grant  execute on function public.record_daily_activity() to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: check_achievements
--   Idempotent unlocks based on user activity stats.
-- -----------------------------------------------------------------------------
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
begin
  if p_user_id is null then return 0; end if;

  select current_streak into v_streak
    from public.profiles where id = p_user_id;

  select count(*)::int into v_trades
    from public.trades where user_id = p_user_id;

  select count(*)::int into v_markets
    from public.markets where creator_id = p_user_id;

  select count(*)::int into v_comments
    from public.market_comments where user_id = p_user_id;

  -- first_trade
  if v_trades >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_trade')
    on conflict do nothing;
    if found then v_count := v_count + 1; end if;
  end if;

  -- first_market
  if v_markets >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_market')
    on conflict do nothing;
  end if;

  -- first_comment
  if v_comments >= 1 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'first_comment')
    on conflict do nothing;
  end if;

  -- streak milestones
  if coalesce(v_streak, 0) >= 3 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_3')
    on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 7 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_7')
    on conflict do nothing;
  end if;
  if coalesce(v_streak, 0) >= 30 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'streak_30')
    on conflict do nothing;
  end if;

  -- volume trader: 1000+ VIBE wagered
  if (
    select coalesce(sum(abs(cost)), 0) from public.trades where user_id = p_user_id
  ) >= 1000 then
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, 'volume_1k')
    on conflict do nothing;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.check_achievements(uuid) from public;
grant  execute on function public.check_achievements(uuid) to authenticated;
