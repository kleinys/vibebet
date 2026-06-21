-- Hotfix: daily hustle tick must never break login / page render (25006-safe).
create or replace function public.record_daily_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_today     date := public._today_utc();
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

  begin
    perform public.check_achievements(v_user_id);
  exception when others then null;
  end;

  begin
    perform public.grant_battle_pass_xp(15);
  exception when others then null;
  end;

  begin
    perform public._tick_daily_hustle(v_user_id, 'login', 1);
  exception when others then null;
  end;

  return jsonb_build_object(
    'current_streak', v_streak,
    'longest_streak', greatest(v_profile.longest_streak, v_streak),
    'already_recorded', false
  );
end;
$$;
