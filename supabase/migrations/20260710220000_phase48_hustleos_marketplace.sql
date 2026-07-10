-- =============================================================================
-- Phase 48: HustleOS Phase D — Task marketplace (Gig board + escrow)
-- =============================================================================
-- Platform gigs (poster_id null) pay from platform subsidy.
-- Community gigs lock poster Hustle Cash in escrow until approve/reject/cancel.

create table if not exists public.hustle_gigs (
  id                  uuid primary key default gen_random_uuid(),
  poster_id           uuid references auth.users(id) on delete set null,
  title               text not null check (char_length(title) between 5 and 120),
  description         text not null check (char_length(description) between 20 and 2000),
  category            text not null default 'content'
    check (category in ('content', 'moderation', 'research', 'creative')),
  reward_vibe         bigint not null check (reward_vibe between 100 and 2000),
  min_hustle_tier     int not null default 3 check (min_hustle_tier between 1 and 5),
  slots               int not null default 1 check (slots between 1 and 50),
  slots_filled        int not null default 0 check (slots_filled >= 0),
  escrow_held         bigint not null default 0 check (escrow_held >= 0),
  is_platform         boolean not null default false,
  status              text not null default 'open'
    check (status in ('open', 'completed', 'cancelled', 'expired')),
  proof_instructions  text,
  expires_at          timestamptz not null default (now() + interval '7 days'),
  created_at          timestamptz not null default now(),
  check (slots_filled <= slots)
);

create index if not exists hustle_gigs_status_expires_idx
  on public.hustle_gigs (status, expires_at desc);

create index if not exists hustle_gigs_poster_idx
  on public.hustle_gigs (poster_id, created_at desc)
  where poster_id is not null;

create table if not exists public.hustle_gig_submissions (
  id              uuid primary key default gen_random_uuid(),
  gig_id          uuid not null references public.hustle_gigs(id) on delete cascade,
  worker_id       uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'claimed'
    check (status in ('claimed', 'submitted', 'approved', 'rejected', 'cancelled')),
  proof_text      text,
  proof_url         text,
  reject_reason     text,
  payout_vibe       bigint,
  claimed_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  resolved_at       timestamptz,
  unique (gig_id, worker_id)
);

create index if not exists hustle_gig_submissions_worker_idx
  on public.hustle_gig_submissions (worker_id, status, claimed_at desc);

create index if not exists hustle_gig_submissions_gig_idx
  on public.hustle_gig_submissions (gig_id, status);

alter table public.hustle_gigs enable row level security;
alter table public.hustle_gig_submissions enable row level security;

drop policy if exists hustle_gigs_select_auth on public.hustle_gigs;
create policy hustle_gigs_select_auth on public.hustle_gigs
  for select to authenticated using (true);

drop policy if exists hustle_gig_submissions_select on public.hustle_gig_submissions;
create policy hustle_gig_submissions_select on public.hustle_gig_submissions
  for select to authenticated
  using (
    worker_id = auth.uid()
    or exists (
      select 1 from public.hustle_gigs g
      where g.id = gig_id and g.poster_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._expire_hustle_gigs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gig public.hustle_gigs%rowtype;
begin
  for v_gig in
    select * from public.hustle_gigs
    where status = 'open' and expires_at <= now()
    for update
  loop
    if v_gig.poster_id is not null and v_gig.escrow_held > 0 then
      update public.profiles
      set hustle_cash_vibe = hustle_cash_vibe + v_gig.escrow_held
      where id = v_gig.poster_id;
    end if;

    update public.hustle_gig_submissions
    set status = 'cancelled', resolved_at = now()
    where gig_id = v_gig.id and status in ('claimed', 'submitted');

    update public.hustle_gigs
    set status = 'expired', escrow_held = 0
    where id = v_gig.id;
  end loop;
end;
$$;

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
  v_fee := floor(p_reward * p_fee_pct / 100.0)::bigint;
  v_net := p_reward - v_fee;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_net
  where id = p_worker_id;

  perform public._refresh_hustle_trust(p_worker_id);

  return v_net;
end;
$$;

create or replace function public._approve_hustle_submission(p_submission_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.hustle_gig_submissions%rowtype;
  v_gig public.hustle_gigs%rowtype;
  v_worker_fee_pct int := 15;
  v_net bigint;
begin
  select * into v_sub
  from public.hustle_gig_submissions
  where id = p_submission_id
  for update;

  if not found then raise exception 'submission not found'; end if;
  if v_sub.status not in ('submitted', 'claimed') then
    raise exception 'submission not approvable';
  end if;

  select * into v_gig from public.hustle_gigs where id = v_sub.gig_id for update;
  if not found then raise exception 'gig not found'; end if;

  select public._hustle_platform_fee_pct(coalesce(trust_score, 500))
  into v_worker_fee_pct
  from public.profiles where id = v_sub.worker_id;

  v_net := public._payout_hustle_gig_worker(v_sub.worker_id, v_gig.reward_vibe, v_worker_fee_pct);

  if not v_gig.is_platform and v_gig.poster_id is not null then
    update public.hustle_gigs
    set escrow_held = greatest(0, escrow_held - v_gig.reward_vibe)
    where id = v_gig.id;
  end if;

  update public.hustle_gig_submissions
  set status = 'approved',
      payout_vibe = v_net,
      resolved_at = now(),
      submitted_at = coalesce(submitted_at, now())
  where id = p_submission_id;

  if v_gig.slots_filled >= v_gig.slots then
    update public.hustle_gigs
    set status = 'completed'
    where id = v_gig.id and status = 'open';
  end if;

  perform public.track_event('hustle_gig_approved', jsonb_build_object(
    'gig_id', v_gig.id,
    'submission_id', p_submission_id,
    'worker_id', v_sub.worker_id,
    'payout', v_net,
    'is_platform', v_gig.is_platform
  ));

  return v_net;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: list marketplace
-- ---------------------------------------------------------------------------
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
  v_open jsonb;
  v_mine jsonb;
  v_posted jsonb;
  v_reviews jsonb;
begin
  perform public._expire_hustle_gigs();

  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select hustle_tier, hustle_cash_vibe
  into v_tier, v_cash
  from public.profiles where id = v_user_id;

  v_tier := coalesce(v_tier, 1);
  v_cash := coalesce(v_cash, 0);

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
      s.status as my_submission_status,
      s.id as my_submission_id
    from public.hustle_gigs g
    left join public.profiles p on p.id = g.poster_id
    left join public.hustle_gig_submissions s
      on s.gig_id = g.id and s.worker_id = v_user_id
    where g.status = 'open'
      and g.expires_at > now()
      and (g.slots - g.slots_filled) > 0
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
    'can_post', v_tier >= 3,
    'open_gigs', v_open,
    'my_submissions', v_mine,
    'my_postings', v_posted,
    'pending_reviews', v_reviews
  );
end;
$$;

revoke execute on function public.get_hustle_marketplace() from public;
grant execute on function public.get_hustle_marketplace() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: post community gig (Gig tier+)
-- ---------------------------------------------------------------------------
create or replace function public.post_hustle_gig(
  p_title text,
  p_description text,
  p_category text,
  p_reward_vibe bigint,
  p_min_hustle_tier int default 3,
  p_slots int default 1,
  p_proof_instructions text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_cash bigint := 0;
  v_escrow bigint;
  v_open int := 0;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select hustle_tier, hustle_cash_vibe into v_tier, v_cash
  from public.profiles where id = v_user_id for update;

  if coalesce(v_tier, 1) < 3 then
    raise exception 'Gig tier required to post — unlock tier 3 first';
  end if;

  if p_reward_vibe < 100 or p_reward_vibe > 2000 then
    raise exception 'reward must be between 100 and 2000 VIBE';
  end if;

  if p_slots < 1 or p_slots > 5 then
    raise exception 'slots must be between 1 and 5';
  end if;

  if p_min_hustle_tier < 1 or p_min_hustle_tier > 5 then
    raise exception 'invalid min tier';
  end if;

  if p_category not in ('content', 'moderation', 'research', 'creative') then
    raise exception 'invalid category';
  end if;

  select count(*)::int into v_open
  from public.hustle_gigs
  where poster_id = v_user_id and status = 'open';

  if v_open >= 5 then
    raise exception 'max 5 open gigs — complete or cancel one first';
  end if;

  v_escrow := p_reward_vibe * p_slots;
  if v_cash < v_escrow then
    raise exception 'insufficient hustle cash — need % in escrow', v_escrow;
  end if;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe - v_escrow
  where id = v_user_id;

  insert into public.hustle_gigs (
    poster_id, title, description, category, reward_vibe,
    min_hustle_tier, slots, escrow_held, is_platform, proof_instructions
  )
  values (
    v_user_id, trim(p_title), trim(p_description), p_category, p_reward_vibe,
    p_min_hustle_tier, p_slots, v_escrow, false, nullif(trim(p_proof_instructions), '')
  )
  returning id into v_id;

  perform public.track_event('hustle_gig_posted', jsonb_build_object(
    'gig_id', v_id,
    'reward', p_reward_vibe,
    'slots', p_slots,
    'escrow', v_escrow
  ));

  return jsonb_build_object('ok', true, 'gig_id', v_id);
end;
$$;

revoke execute on function public.post_hustle_gig(text, text, text, bigint, int, int, text) from public;
grant execute on function public.post_hustle_gig(text, text, text, bigint, int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: claim gig slot
-- ---------------------------------------------------------------------------
create or replace function public.claim_hustle_gig(p_gig_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_gig public.hustle_gigs%rowtype;
  v_active int := 0;
  v_sub_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  perform public._expire_hustle_gigs();

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);

  select * into v_gig from public.hustle_gigs where id = p_gig_id for update;
  if not found then raise exception 'gig not found'; end if;
  if v_gig.status <> 'open' then raise exception 'gig not open'; end if;
  if v_gig.expires_at <= now() then raise exception 'gig expired'; end if;
  if v_gig.slots_filled >= v_gig.slots then raise exception 'no slots left'; end if;
  if v_gig.poster_id = v_user_id then raise exception 'cannot claim your own gig'; end if;
  if v_tier < v_gig.min_hustle_tier then
    raise exception 'tier locked — need tier %', v_gig.min_hustle_tier;
  end if;

  select count(*)::int into v_active
  from public.hustle_gig_submissions
  where worker_id = v_user_id and status in ('claimed', 'submitted');

  if v_active >= 3 then
    raise exception 'max 3 active gig claims — finish one first';
  end if;

  insert into public.hustle_gig_submissions (gig_id, worker_id)
  values (p_gig_id, v_user_id)
  returning id into v_sub_id;

  update public.hustle_gigs
  set slots_filled = slots_filled + 1
  where id = p_gig_id;

  perform public.track_event('hustle_gig_claimed', jsonb_build_object(
    'gig_id', p_gig_id,
    'submission_id', v_sub_id
  ));

  return jsonb_build_object('ok', true, 'submission_id', v_sub_id);
end;
$$;

revoke execute on function public.claim_hustle_gig(uuid) from public;
grant execute on function public.claim_hustle_gig(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: submit proof
-- ---------------------------------------------------------------------------
create or replace function public.submit_hustle_gig_proof(
  p_submission_id uuid,
  p_proof_text text,
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub public.hustle_gig_submissions%rowtype;
  v_gig public.hustle_gigs%rowtype;
  v_net bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_proof_text is null or char_length(trim(p_proof_text)) < 30 then
    raise exception 'proof must be at least 30 characters';
  end if;

  select * into v_sub
  from public.hustle_gig_submissions
  where id = p_submission_id and worker_id = v_user_id
  for update;

  if not found then raise exception 'submission not found'; end if;
  if v_sub.status <> 'claimed' then raise exception 'submission not in claimed state'; end if;

  select * into v_gig from public.hustle_gigs where id = v_sub.gig_id;

  update public.hustle_gig_submissions
  set status = 'submitted',
      proof_text = trim(p_proof_text),
      proof_url = nullif(trim(p_proof_url), ''),
      submitted_at = now()
  where id = p_submission_id;

  if v_gig.is_platform then
    v_net := public._approve_hustle_submission(p_submission_id);
    return jsonb_build_object('ok', true, 'auto_approved', true, 'payout', v_net);
  end if;

  return jsonb_build_object('ok', true, 'auto_approved', false);
end;
$$;

revoke execute on function public.submit_hustle_gig_proof(uuid, text, text) from public;
grant execute on function public.submit_hustle_gig_proof(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: poster approves or rejects
-- ---------------------------------------------------------------------------
create or replace function public.review_hustle_gig_submission(
  p_submission_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub public.hustle_gig_submissions%rowtype;
  v_gig public.hustle_gigs%rowtype;
  v_net bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_action not in ('approve', 'reject') then raise exception 'invalid action'; end if;

  select * into v_sub from public.hustle_gig_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission not found'; end if;

  select * into v_gig from public.hustle_gigs where id = v_sub.gig_id for update;
  if v_gig.poster_id is distinct from v_user_id then
    raise exception 'only the poster can review';
  end if;

  if v_sub.status <> 'submitted' then
    raise exception 'submission not awaiting review';
  end if;

  if p_action = 'approve' then
    v_net := public._approve_hustle_submission(p_submission_id);
    return jsonb_build_object('ok', true, 'payout', v_net);
  end if;

  update public.hustle_gig_submissions
  set status = 'rejected',
      reject_reason = nullif(trim(p_reason), ''),
      resolved_at = now()
  where id = p_submission_id;

  update public.profiles
  set hustle_cash_vibe = hustle_cash_vibe + v_gig.reward_vibe
  where id = v_gig.poster_id;

  update public.hustle_gigs
  set escrow_held = greatest(0, escrow_held - v_gig.reward_vibe),
      slots_filled = greatest(0, slots_filled - 1)
  where id = v_gig.id;

  perform public.track_event('hustle_gig_rejected', jsonb_build_object(
    'gig_id', v_gig.id,
    'submission_id', p_submission_id
  ));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.review_hustle_gig_submission(uuid, text, text) from public;
grant execute on function public.review_hustle_gig_submission(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cancel open gig (poster)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_hustle_gig(p_gig_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_gig public.hustle_gigs%rowtype;
  v_pending int := 0;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_gig from public.hustle_gigs where id = p_gig_id for update;
  if not found then raise exception 'gig not found'; end if;
  if v_gig.poster_id is distinct from v_user_id then raise exception 'not your gig'; end if;
  if v_gig.status <> 'open' then raise exception 'gig not open'; end if;

  select count(*)::int into v_pending
  from public.hustle_gig_submissions
  where gig_id = p_gig_id and status in ('claimed', 'submitted');

  if v_pending > 0 then
    raise exception 'cannot cancel — active worker claims exist';
  end if;

  if v_gig.escrow_held > 0 then
    update public.profiles
    set hustle_cash_vibe = hustle_cash_vibe + v_gig.escrow_held
    where id = v_user_id;
  end if;

  update public.hustle_gigs
  set status = 'cancelled', escrow_held = 0
  where id = p_gig_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.cancel_hustle_gig(uuid) from public;
grant execute on function public.cancel_hustle_gig(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed platform gigs (subsidy — no poster escrow)
-- Community posts stay capped at 5 slots via post_hustle_gig(); platform gigs allow more.
-- ---------------------------------------------------------------------------
alter table public.hustle_gigs
  drop constraint if exists hustle_gigs_slots_check;

alter table public.hustle_gigs
  add constraint hustle_gigs_slots_check
  check (slots between 1 and 50);

insert into public.hustle_gigs (
  id, poster_id, title, description, category, reward_vibe,
  min_hustle_tier, slots, is_platform, proof_instructions, expires_at
)
values
  (
    'a1000001-0001-4000-8000-000000000001',
    null,
    'Tag 10 product images',
    'Open the Spark tag tool and label ten images with accurate product tags. Paste your session summary in proof.',
    'moderation',
    200,
    2,
    20,
    true,
    'Include how many images you tagged and one example tag set.',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000002',
    null,
    'Write a 200-word market brief',
    'Pick any open market and write a neutral 200+ word summary: context, key arguments, and your read (no financial advice).',
    'content',
    350,
    3,
    15,
    true,
    'Paste the market URL and your full write-up (200+ words).',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000003',
    null,
    'Share VibeBet on X with proof',
    'Post a genuine take about prediction markets or a market you follow. Link must stay up 24h.',
    'creative',
    275,
    2,
    25,
    true,
    'Paste the tweet URL and a one-line summary of your angle.',
    now() + interval '30 days'
  ),
  (
    'a1000001-0001-4000-8000-000000000004',
    null,
    'Research 5 competitor features',
    'Compare five features across Polymarket, Kalshi, or similar vs VibeBet. Table format in proof.',
    'research',
    400,
    3,
    10,
    true,
    'Paste a feature comparison table with sources.',
    now() + interval '30 days'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  reward_vibe = excluded.reward_vibe,
  slots = excluded.slots,
  min_hustle_tier = excluded.min_hustle_tier,
  proof_instructions = excluded.proof_instructions,
  expires_at = excluded.expires_at,
  status = case when hustle_gigs.status = 'completed' then hustle_gigs.status else 'open' end,
  is_platform = true;

insert into public.feature_flags (key, enabled, description)
values ('hustle_marketplace_enabled', false, 'HustleOS Gig marketplace — post and claim escrowed tasks')
on conflict (key) do update set description = excluded.description;
