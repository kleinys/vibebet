-- Phase 53: Psychology shell — Vibe Pass, companion naming, feature flag

alter table public.profiles
  add column if not exists companion_name text,
  add column if not exists vibe_pass_dismissed_at timestamptz;

comment on column public.profiles.companion_name is
  'Player-chosen name for their Vibe companion (IKEA effect).';
comment on column public.profiles.vibe_pass_dismissed_at is
  'When set, hide the Vibe Pass progress bar in site chrome.';

create or replace function public._user_has_finished_duel(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.duels d
    where d.status = 'settled'
      and (d.challenger_id = p_user_id or d.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.chess_games g
    where g.status in ('settled', 'draw')
      and (g.creator_id = p_user_id or g.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.checkers_games g
    where g.status in ('settled', 'draw')
      and (g.creator_id = p_user_id or g.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.go_games g
    where g.status in ('settled', 'draw')
      and (g.creator_id = p_user_id or g.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.shogi_games g
    where g.status in ('settled', 'draw')
      and (g.creator_id = p_user_id or g.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.poker_games g
    where g.status in ('settled', 'draw')
      and (g.creator_id = p_user_id or g.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.dice_duels d
    where d.status = 'settled'
      and (d.creator_id = p_user_id or d.opponent_id = p_user_id)
  )
  or exists (
    select 1 from public.rps_duels d
    where d.status = 'settled'
      and (d.creator_id = p_user_id or d.opponent_id = p_user_id)
  );
$$;

revoke all on function public._user_has_finished_duel(uuid) from public;
grant execute on function public._user_has_finished_duel(uuid) to authenticated;

create or replace function public.get_vibe_pass_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_first_bet boolean := false;
  v_duel      boolean := false;
  v_wheel     boolean := false;
  v_done      int := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('visible', false);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    return jsonb_build_object('visible', false);
  end if;

  select exists (
    select 1 from public.onboarding_progress o
    where o.user_id = v_user_id and o.first_bet_at is not null
  )
  or exists (
    select 1 from public.trades t
    where t.user_id = v_user_id and t.cost > 0
    limit 1
  )
  into v_first_bet;

  v_duel := public._user_has_finished_duel(v_user_id);

  select exists (
    select 1 from public.locker_wheel_daily w
    where w.user_id = v_user_id and w.spins_used > 0
  )
  into v_wheel;

  v_done := 1
    + case when v_first_bet then 1 else 0 end
    + case when v_duel then 1 else 0 end
    + case when v_wheel then 1 else 0 end;

  return jsonb_build_object(
    'visible', v_profile.vibe_pass_dismissed_at is null and v_done < 4,
    'percent', v_done * 25,
    'complete', v_done >= 4,
    'dismissed', v_profile.vibe_pass_dismissed_at is not null,
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'join',
        'label', 'Create your account',
        'done', true,
        'href', '/account'
      ),
      jsonb_build_object(
        'id', 'first_bet',
        'label', 'Place your first prediction',
        'done', v_first_bet,
        'href', '/markets'
      ),
      jsonb_build_object(
        'id', 'duel',
        'label', 'Finish a duel',
        'done', v_duel,
        'href', '/play?tab=duels'
      ),
      jsonb_build_object(
        'id', 'wheel',
        'label', 'Spin the locker wheel',
        'done', v_wheel,
        'href', '/account/profile'
      )
    )
  );
end;
$$;

revoke all on function public.get_vibe_pass_progress() from public;
grant execute on function public.get_vibe_pass_progress() to authenticated;

create or replace function public.dismiss_vibe_pass()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not signed in');
  end if;

  update public.profiles
  set vibe_pass_dismissed_at = now(),
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dismiss_vibe_pass() from public;
grant execute on function public.dismiss_vibe_pass() to authenticated;

create or replace function public.set_companion_name(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_trimmed text;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not signed in');
  end if;

  v_trimmed := trim(p_name);
  if char_length(v_trimmed) < 2 or char_length(v_trimmed) > 24 then
    return jsonb_build_object('error', 'Name must be 2–24 characters');
  end if;

  if v_trimmed !~ '^[[:alnum:]][[:alnum:] ''._-]*$' then
    return jsonb_build_object('error', 'Use letters, numbers, spaces, or . _ -');
  end if;

  update public.profiles
  set companion_name = v_trimmed,
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('ok', true, 'name', v_trimmed);
end;
$$;

revoke all on function public.set_companion_name(text) from public;
grant execute on function public.set_companion_name(text) to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('psychology_layer_enabled', true, 'Phase 1 psychology shell — Vibe Pass, smart defaults, streak urgency, guest teasers')
on conflict (key) do update
  set description = excluded.description;
