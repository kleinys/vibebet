-- =============================================================================
-- Phase 51: HustleOS Phase G — Recovery mode + regional variants
-- =============================================================================
-- Earn-only recovery blocks play bridge. Optional daily earn cap while active.
-- Regional packs filter platform gigs and tune wellness defaults.

alter table public.profiles
  add column if not exists hustle_recovery_mode boolean not null default false,
  add column if not exists hustle_recovery_until timestamptz,
  add column if not exists hustle_daily_earn_cap bigint
    check (hustle_daily_earn_cap is null or hustle_daily_earn_cap > 0),
  add column if not exists hustle_region text not null default 'global'
    check (hustle_region in ('global', 'eu', 'us', 'mena', 'latam'));

alter table public.hustle_gigs
  add column if not exists region text not null default 'global'
    check (region in ('global', 'eu', 'us', 'mena', 'latam'));

create index if not exists hustle_gigs_region_idx
  on public.hustle_gigs (region, status);

create or replace function public._clear_expired_hustle_recovery()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set hustle_recovery_mode = false,
      hustle_recovery_until = null,
      hustle_daily_earn_cap = null
  where hustle_recovery_mode = true
    and hustle_recovery_until is not null
    and hustle_recovery_until <= now();
end;
$$;

create or replace function public._hustle_cash_earned_today(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(d.reward_vibe)::bigint
      from public.user_daily_hustle_progress p
      join public.daily_hustle_definitions d on d.id = p.task_id
      where p.user_id = p_user_id
        and p.claimed_at is not null
        and p.claimed_at >= (now() at time zone 'utc')::date
    ), 0)
    + coalesce((
      select sum(s.payout_vibe)::bigint
      from public.hustle_gig_submissions s
      where s.worker_id = p_user_id
        and s.status = 'approved'
        and s.resolved_at is not null
        and s.resolved_at >= (now() at time zone 'utc')::date
    ), 0);
$$;

create or replace function public._assert_hustle_earn_cap(p_user_id uuid, p_amount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_earned bigint;
begin
  perform public._clear_expired_hustle_recovery();

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return; end if;

  if not v_profile.hustle_recovery_mode or v_profile.hustle_daily_earn_cap is null then
    return;
  end if;

  v_earned := public._hustle_cash_earned_today(p_user_id);
  if v_earned + p_amount > v_profile.hustle_daily_earn_cap then
    raise exception 'recovery daily earn cap reached (% VIBE)', v_profile.hustle_daily_earn_cap;
  end if;
end;
$$;

create or replace function public.get_hustle_wellness()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_earned bigint;
  v_cap bigint;
  v_region_label text;
begin
  perform public._clear_expired_hustle_recovery();

  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  v_earned := public._hustle_cash_earned_today(v_user_id);
  v_cap := v_profile.hustle_daily_earn_cap;

  v_region_label := case v_profile.hustle_region
    when 'eu' then 'Europe'
    when 'us' then 'United States'
    when 'mena' then 'MENA'
    when 'latam' then 'Latin America'
    else 'Global'
  end;

  return jsonb_build_object(
    'authenticated', true,
    'recovery_mode', coalesce(v_profile.hustle_recovery_mode, false),
    'recovery_until', v_profile.hustle_recovery_until,
    'self_exclude_until', v_profile.hustle_self_exclude_until,
    'daily_earn_cap', v_cap,
    'earned_today', v_earned,
    'earn_cap_remaining', case
      when v_cap is null then null
      else greatest(0, v_cap - v_earned)
    end,
    'region', v_profile.hustle_region,
    'region_label', v_region_label,
    'blocks_play_bridge', coalesce(v_profile.hustle_recovery_mode, false),
    'regional_gig_count', (
      select count(*)::int from public.hustle_gigs g
      where g.is_platform = true and g.status = 'open'
        and g.region in ('global', v_profile.hustle_region)
    )
  );
end;
$$;

revoke execute on function public.get_hustle_wellness() from public;
grant execute on function public.get_hustle_wellness() to authenticated;

create or replace function public.enable_hustle_recovery(p_days int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_until timestamptz;
  v_cap bigint := 1500;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_days not in (7, 30, 90) then
    raise exception 'recovery period must be 7, 30, or 90 days';
  end if;

  v_until := now() + make_interval(days => p_days);

  update public.profiles
  set hustle_recovery_mode = true,
      hustle_recovery_until = v_until,
      hustle_daily_earn_cap = v_cap,
      hustle_self_exclude_until = greatest(coalesce(hustle_self_exclude_until, v_until), v_until)
  where id = v_user_id;

  perform public.track_event('hustle_recovery_enabled', jsonb_build_object(
    'days', p_days,
    'until', v_until,
    'daily_cap', v_cap
  ));

  return jsonb_build_object('ok', true, 'recovery_until', v_until, 'daily_earn_cap', v_cap);
end;
$$;

revoke execute on function public.enable_hustle_recovery(int) from public;
grant execute on function public.enable_hustle_recovery(int) to authenticated;

create or replace function public.set_hustle_region(p_region text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_region not in ('global', 'eu', 'us', 'mena', 'latam') then
    raise exception 'invalid region';
  end if;

  update public.profiles
  set hustle_region = p_region,
      updated_at = now()
  where id = v_user_id;

  perform public.track_event('hustle_region_set', jsonb_build_object('region', p_region));

  return jsonb_build_object('ok', true, 'region', p_region);
end;
$$;

revoke execute on function public.set_hustle_region(text) from public;
grant execute on function public.set_hustle_region(text) to authenticated;

-- Block earn→play when recovery mode active
create or replace function public.request_hustle_transfer(
  p_direction text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_play bigint := 0;
  v_fee bigint := 0;
  v_net bigint;
  v_id uuid;
  v_completes timestamptz;
  v_daily_used bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_direction not in ('earn_to_play', 'play_to_earn') then
    raise exception 'invalid direction';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  perform public._clear_expired_hustle_recovery();
  perform public._process_due_hustle_transfers(v_user_id);

  select * into v_profile from public.profiles where id = v_user_id for update;

  if v_profile.hustle_recovery_mode and p_direction = 'earn_to_play' then
    raise exception 'recovery mode active — earn→play bridge disabled until %',
      coalesce(v_profile.hustle_recovery_until::text, 'period ends');
  end if;

  if v_profile.hustle_self_exclude_until is not null
     and v_profile.hustle_self_exclude_until > now() then
    raise exception 'transfers self-excluded until %', v_profile.hustle_self_exclude_until;
  end if;

  if p_direction = 'earn_to_play' then
    if p_amount < 50 then raise exception 'minimum earn→play transfer is 50 VIBE'; end if;
    if p_amount > 500 then raise exception 'maximum earn→play transfer is 500 VIBE'; end if;
    if v_profile.hustle_cash_vibe < p_amount then raise exception 'insufficient hustle cash'; end if;

    v_daily_used := public._hustle_transfer_day_total(v_user_id, 'earn_to_play');
    if v_daily_used + p_amount > v_profile.hustle_daily_transfer_limit then
      raise exception 'daily earn→play limit exceeded';
    end if;

    update public.profiles
    set hustle_cash_vibe = hustle_cash_vibe - p_amount
    where id = v_user_id;

    v_completes := case when p_amount > 50 then now() + interval '24 hours' else null end;

    insert into public.hustle_transfers (user_id, direction, amount, fee, status, completes_at)
    values (v_user_id, 'earn_to_play', p_amount, 0, 'pending', v_completes)
    returning id into v_id;

    if v_completes is null then
      perform public._complete_hustle_transfer(v_id);
    end if;
  else
    if p_amount < 100 then raise exception 'minimum play→earn transfer is 100 VIBE'; end if;
    if p_amount > 2000 then raise exception 'maximum play→earn transfer is 2000 VIBE'; end if;

    v_daily_used := public._hustle_transfer_day_total(v_user_id, 'play_to_earn');
    if v_daily_used + p_amount > 5000 then
      raise exception 'daily play→earn limit exceeded';
    end if;

    select coalesce(sum(le.amount), 0)::bigint into v_play
    from public.ledger_entries le
    join public.accounts a on a.id = le.account_id
    where a.owner_user_id = v_user_id
      and a.kind = 'user_wallet'
      and a.currency = 'vibe';

    if v_play < p_amount then raise exception 'insufficient play balance'; end if;

    v_fee := floor(p_amount * 0.05)::bigint;
    v_net := p_amount - v_fee;

    insert into public.hustle_transfers (user_id, direction, amount, fee, status, completes_at)
    values (v_user_id, 'play_to_earn', p_amount, v_fee, 'pending', null)
    returning id into v_id;

    perform public._complete_hustle_transfer(v_id);
  end if;

  return jsonb_build_object('ok', true, 'transfer_id', v_id);
end;
$$;

-- Earn cap on task claims
create or replace function public.claim_daily_hustle_reward(p_task_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_day       date := public._today_utc();
  v_task      public.daily_hustle_definitions%rowtype;
  v_progress  public.user_daily_hustle_progress%rowtype;
  v_tier      int := 1;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);

  select * into v_task from public.daily_hustle_definitions
   where id = p_task_id and active = true;
  if not found then raise exception 'unknown task'; end if;

  if v_task.min_hustle_tier > v_tier then
    raise exception 'tier locked — unlock % first', v_task.min_hustle_tier;
  end if;

  select * into v_progress from public.user_daily_hustle_progress
   where user_id = v_user_id and task_id = p_task_id and day = v_day;
  if not found or v_progress.completed_at is null then
    raise exception 'task not completed';
  end if;
  if v_progress.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  perform public._assert_hustle_earn_cap(v_user_id, v_task.reward_vibe);

  update public.user_daily_hustle_progress
  set claimed_at = now()
  where user_id = v_user_id and task_id = p_task_id and day = v_day;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_task.reward_vibe,
      spark_claims_lifetime = spark_claims_lifetime + case when v_task.task_kind = 'spark' then 1 else 0 end
  where id = v_user_id;

  perform public._refresh_hustle_trust(v_user_id);

  perform public.track_event('daily_hustle_claimed', jsonb_build_object(
    'task_id', p_task_id,
    'reward', v_task.reward_vibe,
    'task_kind', v_task.task_kind,
    'to_hustle_cash', true
  ));

  return v_task.reward_vibe;
end;
$$;

-- Regional gig filter in marketplace listing
create or replace function public.get_hustle_marketplace()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_cash bigint := 0;
  v_region text := 'global';
  v_open jsonb;
  v_mine jsonb;
  v_posted jsonb;
  v_reviews jsonb;
begin
  perform public._expire_hustle_gigs();
  perform public._clear_expired_hustle_recovery();

  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select hustle_tier, hustle_cash_vibe, hustle_region
  into v_tier, v_cash, v_region
  from public.profiles where id = v_user_id;

  v_tier := coalesce(v_tier, 1);
  v_cash := coalesce(v_cash, 0);
  v_region := coalesce(v_region, 'global');

  select coalesce(jsonb_agg(row_to_json(x) order by x.is_platform desc, x.reward_vibe desc), '[]'::jsonb)
  into v_open
  from (
    select
      g.id as gig_id,
      g.title,
      g.description,
      g.category,
      g.reward_vibe,
      g.min_hustle_tier,
      (g.slots - g.slots_filled) as slots_remaining,
      g.is_platform,
      coalesce(p.display_name, 'VibeBet') as poster_name,
      g.expires_at,
      g.status,
      g.proof_instructions,
      g.region,
      s.status as my_submission_status,
      s.id as my_submission_id
    from public.hustle_gigs g
    left join public.profiles p on p.id = g.poster_id
    left join public.hustle_gig_submissions s
      on s.gig_id = g.id and s.worker_id = v_user_id
    where g.status = 'open'
      and g.expires_at > now()
      and (g.slots - g.slots_filled) > 0
      and (g.region in ('global', v_region) or not g.is_platform)
    order by g.is_platform desc, g.reward_vibe desc
    limit 40
  ) x;

  select coalesce(jsonb_agg(row_to_json(y) order by y.claimed_at desc), '[]'::jsonb)
  into v_mine
  from (
    select
      s.id as submission_id,
      s.status,
      s.proof_text,
      s.proof_url,
      s.payout_vibe,
      s.claimed_at,
      s.submitted_at,
      s.resolved_at,
      g.id as gig_id,
      g.title,
      g.reward_vibe,
      g.is_platform,
      g.poster_id,
      coalesce(p.display_name, 'VibeBet') as poster_name
    from public.hustle_gig_submissions s
    join public.hustle_gigs g on g.id = s.gig_id
    left join public.profiles p on p.id = g.poster_id
    where s.worker_id = v_user_id
      and s.status in ('claimed', 'submitted', 'approved')
    order by s.claimed_at desc
    limit 20
  ) y;

  select coalesce(jsonb_agg(row_to_json(z) order by z.created_at desc), '[]'::jsonb)
  into v_posted
  from (
    select
      g.id as gig_id,
      g.title,
      g.reward_vibe,
      g.status,
      g.slots,
      g.slots_filled,
      g.escrow_held,
      g.expires_at,
      g.created_at,
      (
        select count(*)::int
        from public.hustle_gig_submissions s
        where s.gig_id = g.id and s.status = 'submitted'
      ) as pending_review
    from public.hustle_gigs g
    where g.poster_id = v_user_id
    order by g.created_at desc
    limit 20
  ) z;

  select coalesce(jsonb_agg(row_to_json(r) order by r.submitted_at desc), '[]'::jsonb)
  into v_reviews
  from (
    select
      s.id as submission_id,
      s.status,
      s.proof_text,
      s.proof_url,
      s.submitted_at,
      g.id as gig_id,
      g.title,
      g.reward_vibe,
      p.display_name as worker_name
    from public.hustle_gig_submissions s
    join public.hustle_gigs g on g.id = s.gig_id
    join public.profiles p on p.id = s.worker_id
    where g.poster_id = v_user_id
      and s.status = 'submitted'
    order by s.submitted_at desc
    limit 20
  ) r;

  return jsonb_build_object(
    'authenticated', true,
    'hustle_tier', v_tier,
    'hustle_cash', v_cash,
    'hustle_region', v_region,
    'can_post', v_tier >= 3,
    'open_gigs', v_open,
    'my_submissions', v_mine,
    'my_postings', v_posted,
    'pending_reviews', v_reviews
  );
end;
$$;

-- Gig payout earn cap
create or replace function public._payout_hustle_gig_worker(
  p_worker_id uuid,
  p_reward bigint,
  p_fee_pct int
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee bigint;
  v_net bigint;
begin
  perform public._assert_hustle_earn_cap(p_worker_id, p_reward);

  v_fee := floor(p_reward * p_fee_pct / 100.0)::bigint;
  v_net := p_reward - v_fee;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_net
  where id = p_worker_id;

  perform public._refresh_hustle_trust(p_worker_id);

  return v_net;
end;
$$;

-- Regional platform gigs
insert into public.hustle_gigs (
  id, poster_id, title, description, category, reward_vibe,
  min_hustle_tier, slots, is_platform, region, proof_instructions, expires_at
)
values
  (
    'c3000001-0001-4000-8000-000000000001',
    null,
    'EU: Label 10 privacy-safe images',
    'Regional pack — tag product images following EU-style privacy labels (no faces, no PII).',
    'moderation',
    225,
    2,
    15,
    true,
    'eu',
    'List tags used and confirm no personal data in images.',
    now() + interval '30 days'
  ),
  (
    'c3000001-0001-4000-8000-000000000002',
    null,
    'US: Summarize one election market',
    'Regional pack — write a neutral 150+ word summary of any US politics market on VibeBet.',
    'research',
    300,
    3,
    12,
    true,
    'us',
    'Market URL + summary with sources.',
    now() + interval '30 days'
  ),
  (
    'c3000001-0001-4000-8000-000000000003',
    null,
    'MENA: Write 3 Arabic-friendly captions',
    'Regional pack — three short captions (30+ chars) suitable for MENA audiences, English or Arabic.',
    'creative',
    275,
    2,
    20,
    true,
    'mena',
    'Paste all three captions and target product.',
    now() + interval '30 days'
  ),
  (
    'c3000001-0001-4000-8000-000000000004',
    null,
    'LATAM: Share in Spanish or Portuguese',
    'Regional pack — post about VibeBet or prediction markets in Spanish or Portuguese.',
    'creative',
    250,
    2,
    20,
    true,
    'latam',
    'Tweet/post URL + one-line summary.',
    now() + interval '30 days'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  reward_vibe = excluded.reward_vibe,
  region = excluded.region,
  proof_instructions = excluded.proof_instructions,
  expires_at = excluded.expires_at,
  is_platform = true;

insert into public.feature_flags (key, enabled, description)
values ('hustle_recovery_enabled', false, 'HustleOS Recovery Mode — earn-only caps and play bridge lock')
on conflict (key) do update set description = excluded.description;
