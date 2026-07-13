-- Phase 57: Creator hub (module proposals) + expedition timing + raid polish hooks

-- ---------------------------------------------------------------------------
-- Module proposals (user-submitted — admin publishes later)
-- ---------------------------------------------------------------------------

create table if not exists public.module_submissions (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles(id) on delete cascade,
  slug          text not null,
  name          text not null,
  description   text not null,
  kind          text not null check (kind in ('duel', 'hustle', 'market', 'arcade', 'watch')),
  target_href   text not null,
  icon_emoji    text not null default '📦',
  status        text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  created_at    timestamptz not null default now(),
  unique (creator_id, slug)
);

create index if not exists module_submissions_creator_idx
  on public.module_submissions (creator_id, created_at desc);

alter table public.module_submissions enable row level security;

drop policy if exists module_submissions_select on public.module_submissions;
create policy module_submissions_select on public.module_submissions
  for select to authenticated
  using (creator_id = auth.uid());

drop policy if exists module_submissions_insert on public.module_submissions;
create policy module_submissions_insert on public.module_submissions
  for insert to authenticated
  with check (creator_id = auth.uid());

create or replace function public._slugify_module_name(p_name text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'),
    48
  );
$$;

create or replace function public.submit_module_proposal(
  p_name text,
  p_description text,
  p_kind text,
  p_target_href text,
  p_icon_emoji text default '📦'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slug text;
  v_row public.module_submissions%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if length(trim(p_name)) < 3 then raise exception 'name too short'; end if;
  if length(trim(p_description)) < 12 then raise exception 'description too short'; end if;
  if p_kind not in ('duel', 'hustle', 'market', 'arcade', 'watch') then
    raise exception 'invalid kind';
  end if;
  if p_target_href !~ '^/' then raise exception 'target_href must start with /'; end if;

  v_slug := public._slugify_module_name(p_name) || '-' || substr(v_user_id::text, 1, 6);

  insert into public.module_submissions (
    creator_id, slug, name, description, kind, target_href, icon_emoji
  )
  values (
    v_user_id,
    v_slug,
    left(trim(p_name), 64),
    left(trim(p_description), 500),
    p_kind,
    left(trim(p_target_href), 200),
    coalesce(nullif(trim(p_icon_emoji), ''), '📦')
  )
  returning * into v_row;

  perform public.track_event('module_proposal_submitted', jsonb_build_object(
    'slug', v_row.slug,
    'kind', v_row.kind
  ));

  return jsonb_build_object(
    'id', v_row.id,
    'slug', v_row.slug,
    'status', v_row.status,
    'name', v_row.name
  );
end;
$$;

revoke all on function public.submit_module_proposal(text, text, text, text, text) from public;
grant execute on function public.submit_module_proposal(text, text, text, text, text) to authenticated;

create or replace function public.get_my_module_submissions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'name', s.name,
        'kind', s.kind,
        'status', s.status,
        'created_at', s.created_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  from public.module_submissions s
  where s.creator_id = auth.uid();
$$;

revoke all on function public.get_my_module_submissions() from public;
grant execute on function public.get_my_module_submissions() to authenticated;

create or replace function public.get_my_creator_hub()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'install_count', (
      select count(*)::int from public.user_module_installs
      where user_id = auth.uid()
    ),
    'pending_proposals', (
      select count(*)::int from public.module_submissions
      where creator_id = auth.uid() and status = 'pending'
    ),
    'approved_proposals', (
      select count(*)::int from public.module_submissions
      where creator_id = auth.uid() and status = 'approved'
    ),
    'submissions', public.get_my_module_submissions()
  );
$$;

revoke all on function public.get_my_creator_hub() from public;
grant execute on function public.get_my_creator_hub() to authenticated;

-- ---------------------------------------------------------------------------
-- Expedition: 30-minute duration (was 1 hour)
-- ---------------------------------------------------------------------------

create or replace function public.get_companion_expedition_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_started timestamptz;
  v_reward bigint;
  v_claimed timestamptz;
  v_ends timestamptz;
  v_duration interval := interval '30 minutes';
  v_cooldown interval := interval '4 hours';
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select
    companion_expedition_started_at,
    companion_expedition_reward,
    companion_expedition_claimed_at
  into v_started, v_reward, v_claimed
  from public.profiles
  where id = v_user_id;

  if v_started is null then
    return jsonb_build_object(
      'active', false,
      'can_start', true,
      'can_claim', false,
      'reward_vibe', null,
      'ends_at', null,
      'cooldown_ends_at', null
    );
  end if;

  v_ends := v_started + v_duration;

  if now() >= v_ends and v_claimed is null then
    return jsonb_build_object(
      'active', true,
      'can_start', false,
      'can_claim', true,
      'reward_vibe', coalesce(v_reward, 35),
      'ends_at', v_ends,
      'cooldown_ends_at', null
    );
  end if;

  if v_claimed is not null then
    return jsonb_build_object(
      'active', false,
      'can_start', now() >= v_claimed + v_cooldown,
      'can_claim', false,
      'reward_vibe', null,
      'ends_at', null,
      'cooldown_ends_at', v_claimed + v_cooldown
    );
  end if;

  return jsonb_build_object(
    'active', true,
    'can_start', false,
    'can_claim', false,
    'reward_vibe', coalesce(v_reward, 35),
    'ends_at', v_ends,
    'cooldown_ends_at', null
  );
end;
$$;

create or replace function public.claim_companion_expedition()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_started timestamptz;
  v_reward bigint;
  v_claimed timestamptz;
  v_ends timestamptz;
  v_wallet uuid;
  v_mint uuid;
  v_tx_id uuid;
  v_ref text;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select
    companion_expedition_started_at,
    companion_expedition_reward,
    companion_expedition_claimed_at
  into v_started, v_reward, v_claimed
  from public.profiles
  where id = v_user_id;

  if v_started is null then raise exception 'no active expedition'; end if;
  if v_claimed is not null then raise exception 'already claimed'; end if;

  v_ends := v_started + interval '30 minutes';
  if now() < v_ends then
    raise exception 'expedition not finished yet';
  end if;

  v_reward := coalesce(v_reward, 35);

  select public._wallet_for_user(v_user_id) into v_wallet;
  if v_wallet is null then raise exception 'wallet missing'; end if;

  select id into v_mint from public.accounts
  where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';
  if v_mint is null then raise exception 'mint missing'; end if;

  v_ref := 'companion_expedition:' || v_user_id::text || ':' || extract(epoch from v_started)::bigint;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'companion_expedition',
    v_ref,
    jsonb_build_object('reward_vibe', v_reward),
    v_user_id
  )
  on conflict (external_ref) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select id into v_tx_id from public.ledger_transactions where external_ref = v_ref;
  else
    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_wallet, v_reward, 'vibe'),
      (v_tx_id, v_mint, -v_reward, 'vibe');
  end if;

  update public.profiles
  set companion_expedition_claimed_at = now(),
      companion_expedition_started_at = null,
      companion_expedition_reward = null
  where id = v_user_id;

  perform public.track_event('companion_expedition_claimed', jsonb_build_object(
    'reward_vibe', v_reward
  ));

  return public.get_companion_expedition_status()
    || jsonb_build_object('claimed_vibe', v_reward);
end;
$$;

insert into public.feature_flags (key, enabled, description)
values (
  'module_proposals_enabled',
  true,
  'Allow users to submit module proposals at /apps/create (moderation queue)'
)
on conflict (key) do update set description = excluded.description;
