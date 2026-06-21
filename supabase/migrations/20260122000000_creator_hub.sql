-- =============================================================================
-- Phase 8: Creator Hub — market suggestions, creator stats, creator leaderboard
-- =============================================================================

create table if not exists public.market_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 10 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category    public.market_category not null default 'other',
  yes_label   text not null default 'Yes',
  no_label    text not null default 'No',
  status      text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'spawned')),
  vote_count  int not null default 0 check (vote_count >= 0),
  market_id   uuid references public.markets(id) on delete set null,
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists market_suggestions_status_votes_idx
  on public.market_suggestions (status, vote_count desc, created_at desc);

create index if not exists market_suggestions_user_idx
  on public.market_suggestions (user_id, created_at desc);

create table if not exists public.market_suggestion_votes (
  suggestion_id uuid not null references public.market_suggestions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

alter table public.market_suggestions enable row level security;
alter table public.market_suggestion_votes enable row level security;

drop policy if exists market_suggestions_select on public.market_suggestions;
create policy market_suggestions_select on public.market_suggestions
  for select to authenticated, anon
  using (status in ('pending', 'approved', 'spawned') or user_id = auth.uid() or public.is_admin());

drop policy if exists market_suggestions_insert_own on public.market_suggestions;
create policy market_suggestions_insert_own on public.market_suggestions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists market_suggestion_votes_select on public.market_suggestion_votes;
create policy market_suggestion_votes_select on public.market_suggestion_votes
  for select to authenticated
  using (true);

drop policy if exists market_suggestion_votes_insert_own on public.market_suggestion_votes;
create policy market_suggestion_votes_insert_own on public.market_suggestion_votes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists market_suggestion_votes_delete_own on public.market_suggestion_votes;
create policy market_suggestion_votes_delete_own on public.market_suggestion_votes
  for delete to authenticated
  using (user_id = auth.uid());

-- Keep vote_count in sync.
create or replace function public._sync_suggestion_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.market_suggestions
       set vote_count = vote_count + 1, updated_at = now()
     where id = new.suggestion_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.market_suggestions
       set vote_count = greatest(0, vote_count - 1), updated_at = now()
     where id = old.suggestion_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_suggestion_vote_count on public.market_suggestion_votes;
create trigger sync_suggestion_vote_count
  after insert or delete on public.market_suggestion_votes
  for each row execute function public._sync_suggestion_vote_count();

-- ---------------------------------------------------------------------------
-- submit_market_suggestion
-- ---------------------------------------------------------------------------
create or replace function public.submit_market_suggestion(
  p_title       text,
  p_description text default null,
  p_category    text default 'other',
  p_yes_label   text default 'Yes',
  p_no_label    text default 'No'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_pending int;
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if char_length(trim(p_title)) < 10 or char_length(trim(p_title)) > 200 then
    raise exception 'title must be 10-200 characters';
  end if;
  if p_category not in (
    'politics', 'sports', 'crypto', 'tech',
    'entertainment', 'finance', 'world', 'culture', 'other'
  ) then
    raise exception 'invalid category';
  end if;

  select count(*) into v_pending
    from public.market_suggestions
   where user_id = v_user_id and status = 'pending';
  if v_pending >= 5 then
    raise exception 'max 5 pending suggestions — wait for review or withdraw old ones';
  end if;

  insert into public.market_suggestions (
    user_id, title, description, category, yes_label, no_label
  ) values (
    v_user_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_category::public.market_category,
    coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
    coalesce(nullif(trim(p_no_label), ''), 'No')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_market_suggestion(text, text, text, text, text) from public;
grant  execute on function public.submit_market_suggestion(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- vote_market_suggestion — toggle upvote
-- ---------------------------------------------------------------------------
create or replace function public.vote_market_suggestion(p_suggestion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status  text;
  v_voted   boolean;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select status into v_status
    from public.market_suggestions where id = p_suggestion_id;
  if not found then raise exception 'suggestion not found'; end if;
  if v_status not in ('pending', 'approved') then
    raise exception 'cannot vote on this suggestion';
  end if;

  select exists(
    select 1 from public.market_suggestion_votes
     where suggestion_id = p_suggestion_id and user_id = v_user_id
  ) into v_voted;

  if v_voted then
    delete from public.market_suggestion_votes
     where suggestion_id = p_suggestion_id and user_id = v_user_id;
    return jsonb_build_object('voted', false);
  else
    insert into public.market_suggestion_votes (suggestion_id, user_id)
    values (p_suggestion_id, v_user_id);
    return jsonb_build_object('voted', true);
  end if;
end;
$$;

revoke execute on function public.vote_market_suggestion(uuid) from public;
grant  execute on function public.vote_market_suggestion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_creator_stats — earnings + volume for auth user (or p_user_id if self)
-- ---------------------------------------------------------------------------
create or replace function public.get_creator_stats(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id       uuid := coalesce(p_user_id, auth.uid());
  v_wallet        uuid;
  v_markets       int;
  v_series        int;
  v_volume        bigint;
  v_fee_earned    bigint;
  v_bonus_earned  bigint;
  v_bonus_eligible int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';

  select count(*) into v_markets
    from public.markets
   where creator_id = v_user_id and source = 'community'
     and recurring_series_id is null;

  select count(*) into v_series
    from public.recurring_market_series
   where creator_id = v_user_id;

  select coalesce(sum(abs(t.cost)), 0) into v_volume
    from public.trades t
    join public.markets m on m.id = t.market_id
   where m.creator_id = v_user_id;

  if v_wallet is not null then
    select coalesce(sum(le.amount), 0) into v_fee_earned
      from public.ledger_entries le
      join public.ledger_transactions lt on lt.id = le.transaction_id
     where le.account_id = v_wallet
       and le.amount > 0
       and lt.kind = 'market_trade'
       and coalesce((lt.metadata->>'creator_fee')::bigint, 0) > 0;

    select coalesce(sum(le.amount), 0) into v_bonus_earned
      from public.ledger_entries le
      join public.ledger_transactions lt on lt.id = le.transaction_id
     where le.account_id = v_wallet
       and le.amount > 0
       and lt.kind = 'creator_bonus';
  else
    v_fee_earned := 0;
    v_bonus_earned := 0;
  end if;

  select count(*) into v_bonus_eligible
    from public.markets m
   where m.creator_id = v_user_id
     and m.source = 'community'
     and not m.creator_bonus_paid
     and m.status = 'open'
     and (
       select coalesce(sum(abs(t.cost)), 0)
         from public.trades t where t.market_id = m.id
     ) >= 4000;

  return jsonb_build_object(
    'markets_created', v_markets,
    'recurring_series', v_series,
    'total_volume', v_volume,
    'fee_earned', v_fee_earned,
    'bonus_earned', v_bonus_earned,
    'bonus_near_count', v_bonus_eligible
  );
end;
$$;

revoke execute on function public.get_creator_stats(uuid) from public;
grant  execute on function public.get_creator_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- creator_leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.creator_leaderboard(p_limit int default 25)
returns table (
  rank           int,
  user_id        uuid,
  display_name   text,
  total_volume   bigint,
  fee_earned     bigint,
  markets_created int,
  series_count   int
)
language sql
security definer
set search_path = ''
stable
as $$
  with creators as (
    select m.creator_id as uid
      from public.markets m
     where m.creator_id is not null
       and m.source = 'community'
     group by m.creator_id
    union
    select r.creator_id as uid
      from public.recurring_market_series r
     group by r.creator_id
  ),
  vol as (
    select m.creator_id as uid, coalesce(sum(abs(t.cost)), 0)::bigint as total_volume
      from public.trades t
      join public.markets m on m.id = t.market_id
     where m.creator_id is not null
     group by m.creator_id
  ),
  fees as (
    select a.owner_user_id as uid, coalesce(sum(le.amount), 0)::bigint as fee_earned
      from public.ledger_entries le
      join public.ledger_transactions lt on lt.id = le.transaction_id
      join public.accounts a on a.id = le.account_id
     where a.kind = 'user_wallet' and a.currency = 'vibe'
       and le.amount > 0
       and lt.kind = 'market_trade'
       and coalesce((lt.metadata->>'creator_fee')::bigint, 0) > 0
     group by a.owner_user_id
  ),
  mkt as (
    select creator_id as uid, count(*)::int as markets_created
      from public.markets
     where source = 'community' and recurring_series_id is null
     group by creator_id
  ),
  ser as (
    select creator_id as uid, count(*)::int as series_count
      from public.recurring_market_series
     group by creator_id
  )
  select
    row_number() over (order by coalesce(v.total_volume, 0) desc)::int as rank,
    c.uid as user_id,
    coalesce(p.display_name, 'Anonymous') as display_name,
    coalesce(v.total_volume, 0) as total_volume,
    coalesce(f.fee_earned, 0) as fee_earned,
    coalesce(m.markets_created, 0) as markets_created,
    coalesce(s.series_count, 0) as series_count
  from creators c
  left join public.profiles p on p.id = c.uid
  left join vol v on v.uid = c.uid
  left join fees f on f.uid = c.uid
  left join mkt m on m.uid = c.uid
  left join ser s on s.uid = c.uid
  order by coalesce(v.total_volume, 0) desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.creator_leaderboard(int) from public;
grant  execute on function public.creator_leaderboard(int) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Admin: approve / reject suggestion
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolve_suggestion(
  p_suggestion_id uuid,
  p_action        text,
  p_note          text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_status   text;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;

  select status into v_status
    from public.market_suggestions where id = p_suggestion_id for update;
  if not found then raise exception 'suggestion not found'; end if;
  if v_status <> 'pending' then raise exception 'suggestion already resolved'; end if;

  if p_action = 'approve' then
    update public.market_suggestions
       set status = 'approved', admin_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
     where id = p_suggestion_id;
  elsif p_action = 'reject' then
    update public.market_suggestions
       set status = 'rejected', admin_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
     where id = p_suggestion_id;
  else
    raise exception 'action must be approve or reject';
  end if;
end;
$$;

revoke execute on function public.admin_resolve_suggestion(uuid, text, text) from public;
grant  execute on function public.admin_resolve_suggestion(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: spawn community market from approved suggestion (platform-funded)
-- ---------------------------------------------------------------------------
create or replace function public.admin_spawn_suggested_market(
  p_suggestion_id uuid,
  p_subsidy       bigint default 500
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin   boolean;
  v_suggestion public.market_suggestions%rowtype;
  v_market_id  uuid;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if p_subsidy < 100 or p_subsidy > 100000 then
    raise exception 'subsidy must be 100-100000 VIBE';
  end if;

  select * into v_suggestion
    from public.market_suggestions
   where id = p_suggestion_id for update;
  if not found then raise exception 'suggestion not found'; end if;
  if v_suggestion.status not in ('pending', 'approved') then
    raise exception 'suggestion not spawnable (status=%)', v_suggestion.status;
  end if;

  v_market_id := public._create_platform_market(
    v_suggestion.user_id,
    v_suggestion.title,
    coalesce(v_suggestion.description, 'Community suggestion — play money only.'),
    p_subsidy,
    0.5,
    now() + interval '90 days',
    v_suggestion.category,
    v_suggestion.yes_label,
    v_suggestion.no_label,
    'community'::public.market_source,
    false,
    null, null, null, null, null
  );

  update public.market_suggestions
     set status = 'spawned',
         market_id = v_market_id,
         updated_at = now()
   where id = p_suggestion_id;

  return v_market_id;
end;
$$;

revoke execute on function public.admin_spawn_suggested_market(uuid, bigint) from public;
grant  execute on function public.admin_spawn_suggested_market(uuid, bigint) to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  (
    'creator_hub_enabled',
    false,
    'Creator dashboard with earnings stats and leaderboard'
  ),
  (
    'market_suggestions_enabled',
    false,
    'Community market suggestions with upvotes and admin spawn'
  )
on conflict (key) do update set description = excluded.description;
