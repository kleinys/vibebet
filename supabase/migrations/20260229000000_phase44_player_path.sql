-- Phase 44: Player path picker (Predict / Compete / Watch) — switchable anytime

alter table public.profiles
  add column if not exists player_path text not null default 'explore'
  check (player_path in ('predict', 'compete', 'watch', 'explore'));

create index if not exists profiles_player_path_idx on public.profiles (player_path);

-- Persist chosen mode (onboarding + top bar switcher)
create or replace function public.set_player_path(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_path not in ('predict', 'compete', 'watch', 'explore') then
    raise exception 'invalid player path';
  end if;

  update public.profiles
     set player_path = p_path,
         updated_at = now()
   where id = v_user_id;
end;
$$;

revoke execute on function public.set_player_path(text) from public;
grant execute on function public.set_player_path(text) to authenticated;

create or replace function public.save_onboarding_path(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_path not in ('predict', 'compete', 'watch', 'explore') then
    raise exception 'invalid player path';
  end if;

  perform public.set_player_path(p_path);

  insert into public.onboarding_progress (user_id, step)
  values (v_user_id, 1)
  on conflict (user_id) do update set
    step = greatest(public.onboarding_progress.step, 1),
    updated_at = now();
end;
$$;

revoke execute on function public.save_onboarding_path(text) from public;
grant execute on function public.save_onboarding_path(text) to authenticated;

create or replace function public.get_onboarding_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_row     public.onboarding_progress%rowtype;
  v_path    text;
begin
  if v_user_id is null then return jsonb_build_object('skipped', true); end if;

  insert into public.onboarding_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.onboarding_progress where user_id = v_user_id;

  select coalesce(p.player_path, 'explore') into v_path
  from public.profiles p where p.id = v_user_id;

  return jsonb_build_object(
    'step', v_row.step,
    'interests', to_jsonb(v_row.interests),
    'first_bet_at', v_row.first_bet_at,
    'completed', v_row.completed_at is not null,
    'skipped', v_row.skipped_at is not null,
    'player_path', v_path
  );
end;
$$;

insert into public.feature_flags (key, enabled, description)
values (
  'player_path_picker_enabled',
  true,
  'Top bar Predict / Compete / Watch mode switcher + onboarding path step'
)
on conflict (key) do update set description = excluded.description;
