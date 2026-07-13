-- Phase 55: Economy UI simplification + companion expedition

alter table public.profiles
  add column if not exists companion_expedition_started_at timestamptz,
  add column if not exists companion_expedition_reward bigint,
  add column if not exists companion_expedition_claimed_at timestamptz;

comment on column public.profiles.companion_expedition_started_at is
  'When the companion passive expedition began (Hustle interconnect).';
comment on column public.profiles.companion_expedition_reward is
  'Pre-rolled VIBE reward for the active expedition claim.';
comment on column public.profiles.companion_expedition_claimed_at is
  'Last expedition claim time — used for cooldown.';

insert into public.feature_flags (key, enabled, description)
values (
  'unified_economy_ui_enabled',
  true,
  'Phase 3 economy UI — single VIBE display, hide bridge, tier-gate advanced hustle'
)
on conflict (key) do update
set description = excluded.description;

-- ---------------------------------------------------------------------------
-- Companion expedition (passive earn — credits play VIBE)
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
  v_duration interval := interval '1 hour';
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

revoke all on function public.get_companion_expedition_status() from public;
grant execute on function public.get_companion_expedition_status() to authenticated;

create or replace function public.start_companion_expedition()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_started timestamptz;
  v_claimed timestamptz;
  v_reward bigint;
  v_cooldown interval := interval '4 hours';
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select
    companion_expedition_started_at,
    companion_expedition_claimed_at
  into v_started, v_claimed
  from public.profiles
  where id = v_user_id;

  if v_started is not null and v_claimed is null then
    raise exception 'expedition already in progress';
  end if;

  if v_claimed is not null and now() < v_claimed + v_cooldown then
    raise exception 'expedition on cooldown';
  end if;

  v_reward := 25 + floor(random() * 26)::bigint;

  update public.profiles
  set companion_expedition_started_at = now(),
      companion_expedition_reward = v_reward,
      companion_expedition_claimed_at = null
  where id = v_user_id;

  return public.get_companion_expedition_status();
end;
$$;

revoke all on function public.start_companion_expedition() from public;
grant execute on function public.start_companion_expedition() to authenticated;

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

  v_ends := v_started + interval '1 hour';
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

revoke all on function public.claim_companion_expedition() from public;
grant execute on function public.claim_companion_expedition() to authenticated;
