-- =============================================================================
-- Phase 50: HustleOS Phase F — Governance (share + tier weighted voting)
-- =============================================================================
-- Advisory polls for HustleOS roadmap. Votes are non-binding until admin acts.
-- Weight = min(25, hustle_tier + floor(hustle_shares * 2))

create table if not exists public.hustle_governance_proposals (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references auth.users(id) on delete set null,
  title           text not null check (char_length(title) between 10 and 160),
  description     text not null check (char_length(description) between 20 and 2000),
  category        text not null default 'platform'
    check (category in ('platform', 'economy', 'tasks', 'community')),
  status          text not null default 'open'
    check (status in ('open', 'passed', 'rejected', 'closed')),
  min_vote_tier   int not null default 2 check (min_vote_tier between 1 and 5),
  is_platform     boolean not null default false,
  ends_at         timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now()
);

create index if not exists hustle_governance_proposals_status_idx
  on public.hustle_governance_proposals (status, ends_at desc);

create table if not exists public.hustle_governance_votes (
  proposal_id     uuid not null references public.hustle_governance_proposals(id) on delete cascade,
  voter_id        uuid not null references auth.users(id) on delete cascade,
  support         boolean not null,
  voting_power    int not null check (voting_power > 0 and voting_power <= 25),
  voted_at        timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

create index if not exists hustle_governance_votes_proposal_idx
  on public.hustle_governance_votes (proposal_id);

alter table public.hustle_governance_proposals enable row level security;
alter table public.hustle_governance_votes enable row level security;

drop policy if exists hustle_governance_proposals_select on public.hustle_governance_proposals;
create policy hustle_governance_proposals_select on public.hustle_governance_proposals
  for select to authenticated using (true);

drop policy if exists hustle_governance_votes_select on public.hustle_governance_votes;
create policy hustle_governance_votes_select on public.hustle_governance_votes
  for select to authenticated using (true);

create or replace function public._hustle_voting_power(p_user_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tier int := 1;
  v_shares numeric(12, 4) := 0;
  v_power int;
begin
  select hustle_tier, hustle_shares
  into v_tier, v_shares
  from public.profiles where id = p_user_id;

  v_power := coalesce(v_tier, 1) + floor(coalesce(v_shares, 0) * 2)::int;
  return greatest(1, least(25, v_power));
end;
$$;

create or replace function public._close_expired_hustle_proposals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.hustle_governance_proposals%rowtype;
  v_for int;
  v_against int;
begin
  for v_row in
    select * from public.hustle_governance_proposals
    where status = 'open' and ends_at <= now()
    for update
  loop
    select
      coalesce(sum(voting_power) filter (where support), 0)::int,
      coalesce(sum(voting_power) filter (where not support), 0)::int
    into v_for, v_against
    from public.hustle_governance_votes
    where proposal_id = v_row.id;

    update public.hustle_governance_proposals
    set status = case
      when v_for > v_against then 'passed'
      when v_against > v_for then 'rejected'
      else 'closed'
    end
    where id = v_row.id;
  end loop;
end;
$$;

create or replace function public.get_hustle_governance()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_power int := 1;
  v_proposals jsonb;
begin
  perform public._close_expired_hustle_proposals();

  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  v_tier := coalesce(v_tier, 1);
  v_power := public._hustle_voting_power(v_user_id);

  select coalesce(jsonb_agg(row_to_json(p) order by p.ends_at desc), '[]'::jsonb)
  into v_proposals
  from (
    select
      g.id as proposal_id,
      g.title,
      g.description,
      g.category,
      g.status,
      g.min_vote_tier,
      g.is_platform,
      g.ends_at,
      g.created_at,
      coalesce(sum(v.voting_power) filter (where v.support), 0)::int as votes_for,
      coalesce(sum(v.voting_power) filter (where not v.support), 0)::int as votes_against,
      count(v.voter_id)::int as voter_count,
      mv.support as my_vote,
      mv.voting_power as my_power,
      (g.status = 'open' and g.ends_at > now()) as is_open,
      (v_tier >= g.min_vote_tier) as can_vote
    from public.hustle_governance_proposals g
    left join public.hustle_governance_votes v on v.proposal_id = g.id
    left join public.hustle_governance_votes mv
      on mv.proposal_id = g.id and mv.voter_id = v_user_id
    where g.status in ('open', 'passed', 'rejected', 'closed')
    group by g.id, g.title, g.description, g.category, g.status, g.min_vote_tier,
             g.is_platform, g.ends_at, g.created_at, mv.support, mv.voting_power
    order by
      case when g.status = 'open' then 0 else 1 end,
      g.ends_at desc
    limit 20
  ) p;

  return jsonb_build_object(
    'authenticated', true,
    'hustle_tier', v_tier,
    'voting_power', v_power,
    'can_propose', v_tier >= 5,
    'min_propose_tier', 5,
    'proposals', v_proposals
  );
end;
$$;

revoke execute on function public.get_hustle_governance() from public;
grant execute on function public.get_hustle_governance() to authenticated;

create or replace function public.cast_hustle_governance_vote(
  p_proposal_id uuid,
  p_support boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_power int;
  v_prop public.hustle_governance_proposals%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  perform public._close_expired_hustle_proposals();

  select * into v_prop
  from public.hustle_governance_proposals
  where id = p_proposal_id
  for update;

  if not found then raise exception 'proposal not found'; end if;
  if v_prop.status <> 'open' or v_prop.ends_at <= now() then
    raise exception 'voting closed';
  end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  if coalesce(v_tier, 1) < v_prop.min_vote_tier then
    raise exception 'tier % required to vote', v_prop.min_vote_tier;
  end if;

  v_power := public._hustle_voting_power(v_user_id);

  insert into public.hustle_governance_votes (proposal_id, voter_id, support, voting_power)
  values (p_proposal_id, v_user_id, p_support, v_power)
  on conflict (proposal_id, voter_id) do update set
    support = excluded.support,
    voting_power = excluded.voting_power,
    voted_at = now();

  perform public.track_event('hustle_governance_vote', jsonb_build_object(
    'proposal_id', p_proposal_id,
    'support', p_support,
    'power', v_power
  ));

  return jsonb_build_object('ok', true, 'voting_power', v_power);
end;
$$;

revoke execute on function public.cast_hustle_governance_vote(uuid, boolean) from public;
grant execute on function public.cast_hustle_governance_vote(uuid, boolean) to authenticated;

create or replace function public.submit_hustle_governance_proposal(
  p_title text,
  p_description text,
  p_category text default 'community'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier int := 1;
  v_open int := 0;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select hustle_tier into v_tier from public.profiles where id = v_user_id;
  if coalesce(v_tier, 1) < 5 then
    raise exception 'Elite tier (5) required to submit proposals';
  end if;

  if p_category not in ('platform', 'economy', 'tasks', 'community') then
    raise exception 'invalid category';
  end if;

  select count(*)::int into v_open
  from public.hustle_governance_proposals
  where author_id = v_user_id and status = 'open';

  if v_open >= 2 then
    raise exception 'max 2 open proposals — wait for one to close';
  end if;

  insert into public.hustle_governance_proposals (
    author_id, title, description, category, min_vote_tier, is_platform
  )
  values (
    v_user_id,
    trim(p_title),
    trim(p_description),
    p_category,
    2,
    false
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'proposal_id', v_id);
end;
$$;

revoke execute on function public.submit_hustle_governance_proposal(text, text, text) from public;
grant execute on function public.submit_hustle_governance_proposal(text, text, text) to authenticated;

-- Seed platform advisory polls
insert into public.hustle_governance_proposals (
  id, author_id, title, description, category, min_vote_tier, is_platform, ends_at
)
values
  (
    'b2000001-0001-4000-8000-000000000001',
    null,
    'Rotate Flash tasks weekly?',
    'Should VibeBet rotate the three Flash-tier hustle tasks every Monday so repeat grinders see fresh goals?',
    'tasks',
    2,
    true,
    now() + interval '21 days'
  ),
  (
    'b2000001-0001-4000-8000-000000000002',
    null,
    'Lower bridge minimum to 25 VIBE?',
    'Earn→Play bridge currently requires 50 VIBE minimum. Lower to 25 for newer hustlers?',
    'economy',
    3,
    true,
    now() + interval '21 days'
  ),
  (
    'b2000001-0001-4000-8000-000000000003',
    null,
    'Boost platform gig rewards 10%?',
    'Increase subsidized platform gig payouts by 10% for the next month to grow the marketplace?',
    'economy',
    2,
    true,
    now() + interval '21 days'
  ),
  (
    'b2000001-0001-4000-8000-000000000004',
    null,
    'Add Hustle dispute jury?',
    'Route rejected gig proofs to a 3-voter Meme Court-style jury before final escrow split?',
    'community',
    3,
    true,
    now() + interval '21 days'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  min_vote_tier = excluded.min_vote_tier,
  ends_at = excluded.ends_at,
  is_platform = true;

insert into public.feature_flags (key, enabled, description)
values ('hustle_governance_enabled', false, 'HustleOS governance polls — tier + share weighted votes')
on conflict (key) do update set description = excluded.description;
