-- =============================================================================
-- Phase 21: Duel spectator markets, guild weekly quest, creator dashboard v2
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.duels
  add column if not exists spectator_market_id uuid references public.markets(id) on delete set null;

alter table public.markets
  add column if not exists duel_id uuid references public.duels(id) on delete set null;

create unique index if not exists markets_duel_id_unique
  on public.markets (duel_id)
  where duel_id is not null;

create table if not exists public.guild_weekly_quest_claims (
  guild_id    uuid not null references public.guilds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  claimed_at  timestamptz not null default now(),
  primary key (guild_id, user_id, week_start)
);

alter table public.guild_weekly_quest_claims enable row level security;

drop policy if exists guild_quest_claims_select on public.guild_weekly_quest_claims;
create policy guild_quest_claims_select on public.guild_weekly_quest_claims
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Duel spectator market (platform-funded CPMM on "who wins the duel")
-- ---------------------------------------------------------------------------
create or replace function public._create_duel_spectator_market(p_duel_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel           public.duels%rowtype;
  v_market         public.markets%rowtype;
  v_challenger     text;
  v_opponent       text;
  v_question       text;
  v_spectator_id   uuid;
  v_closes         timestamptz;
begin
  select * into v_duel from public.duels where id = p_duel_id;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'accepted' then raise exception 'duel not active'; end if;
  if v_duel.spectator_market_id is not null then return v_duel.spectator_market_id; end if;
  if v_duel.opponent_id is null then raise exception 'duel has no opponent'; end if;

  select * into v_market from public.markets where id = v_duel.market_id;
  if not found then raise exception 'underlying market not found'; end if;

  select coalesce(display_name, 'Challenger') into v_challenger
    from public.profiles where id = v_duel.challenger_id;
  select coalesce(display_name, 'Opponent') into v_opponent
    from public.profiles where id = v_duel.opponent_id;

  v_question := format(
    'Duel: Will %s beat %s on "%s"?',
    left(v_challenger, 40),
    left(v_opponent, 40),
    left(v_market.question, 120)
  );

  v_closes := coalesce(v_market.closes_at, v_duel.expires_at, now() + interval '30 days');

  v_spectator_id := public._create_platform_market(
    v_duel.challenger_id,
    left(v_question, 280),
    format(
      'Spectator market for duel %s. Resolves YES if %s wins the head-to-head duel '
      '(correct side on the underlying market). Settles when the underlying market resolves.',
      p_duel_id,
      v_challenger
    ),
    2500,
    0.5,
    v_closes,
    'other'::public.market_category,
    left(v_challenger, 32),
    left(v_opponent, 32),
    'platform'::public.market_source,
    false,
    null, null, null, null, null
  );

  update public.markets
     set duel_id = p_duel_id
   where id = v_spectator_id;

  update public.duels
     set spectator_market_id = v_spectator_id
   where id = p_duel_id;

  return v_spectator_id;
end;
$$;

revoke execute on function public._create_duel_spectator_market(uuid) from public;

-- Patch accept_duel: spawn spectator market when flag is on.
create or replace function public.accept_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_duel      public.duels%rowtype;
  v_market    public.markets%rowtype;
  v_spec_on   boolean := false;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'pending' then raise exception 'duel is not pending'; end if;
  if v_duel.expires_at <= now() then raise exception 'duel expired'; end if;
  if v_duel.challenger_id = v_user_id then raise exception 'cannot accept your own duel'; end if;
  if v_duel.opponent_id is not null and v_duel.opponent_id <> v_user_id then
    raise exception 'this duel is for someone else';
  end if;

  select * into v_market from public.markets where id = v_duel.market_id;
  if v_market.status <> 'open' then raise exception 'market is no longer open'; end if;

  perform public._debit_wallet_to_escrow(
    v_user_id,
    v_duel.stake,
    'duel_accept',
    'duel_accept:' || p_duel_id::text,
    public._duel_escrow_code(p_duel_id),
    jsonb_build_object('duel_id', p_duel_id)
  );

  update public.duels
     set status = 'accepted',
         opponent_id = v_user_id,
         opponent_side = case when v_duel.challenger_side = 'yes' then 'no'::public.trade_side else 'yes'::public.trade_side end,
         accepted_at = now()
   where id = p_duel_id;

  select coalesce(
    (select enabled from public.feature_flags where key = 'duel_spectator_markets_enabled'),
    false
  ) into v_spec_on;

  if v_spec_on then
    perform public._create_duel_spectator_market(p_duel_id);
  end if;
end;
$$;

-- Patch duel settlement: resolve spectator market with challenger-won outcome.
create or replace function public._settle_duels_for_market(
  p_market_id uuid,
  p_outcome   boolean
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel           record;
  v_winner         uuid;
  v_wallet         uuid;
  v_escrow         uuid;
  v_tx_id          uuid;
  v_count          int := 0;
  v_challenger_won boolean;
begin
  for v_duel in
    select * from public.duels
     where market_id = p_market_id and status = 'accepted'
     for update
  loop
    if (v_duel.challenger_side = 'yes' and p_outcome)
       or (v_duel.challenger_side = 'no' and not p_outcome) then
      v_winner := v_duel.challenger_id;
    else
      v_winner := v_duel.opponent_id;
    end if;

    v_challenger_won := (v_winner = v_duel.challenger_id);

    select public._wallet_for_user(v_winner) into v_wallet;
    select id into v_escrow from public.accounts
     where kind = 'system_burn'
       and currency = 'vibe'
       and code = public._duel_escrow_code(v_duel.id);

    if v_wallet is not null and v_escrow is not null then
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values (
        'duel_settle',
        'duel_settle:' || v_duel.id::text,
        jsonb_build_object('duel_id', v_duel.id, 'winner_id', v_winner),
        null
      ) returning id into v_tx_id;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -(v_duel.stake * 2), 'vibe'),
        (v_tx_id, v_wallet,  (v_duel.stake * 2), 'vibe');
    end if;

    if v_duel.spectator_market_id is not null then
      begin
        perform public.finalize_market_internal(
          v_duel.spectator_market_id,
          v_challenger_won
        );
      exception when others then null;
      end;
    end if;

    update public.duels
       set status = 'settled',
           winner_id = v_winner,
           settled_at = now()
     where id = v_duel.id;

    v_count := v_count + 1;
  end loop;

  for v_duel in
    select * from public.duels
     where market_id = p_market_id and status = 'pending'
     for update
  loop
    perform public._refund_duel_escrow(v_duel.id, v_duel.challenger_id, v_duel.stake, 'duel_market_closed');
    update public.duels set status = 'cancelled' where id = v_duel.id;
  end loop;

  return v_count;
end;
$$;

-- Broader read access for active spectator duels.
drop policy if exists duels_select on public.duels;
create policy duels_select on public.duels
  for select to authenticated
  using (
    challenger_id = auth.uid()
    or opponent_id = auth.uid()
    or (status = 'pending' and (opponent_id is null or opponent_id = auth.uid()))
    or (status = 'accepted' and spectator_market_id is not null)
  );

create or replace function public.get_active_spectator_duels(p_limit int default 15)
returns table (
  duel_id              uuid,
  challenger_name      text,
  opponent_name        text,
  market_question      text,
  underlying_market_id uuid,
  spectator_market_id  uuid,
  stake                bigint,
  accepted_at          timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    d.id,
    coalesce(pc.display_name, 'Challenger'),
    coalesce(po.display_name, 'Opponent'),
    left(m.question, 120),
    d.market_id,
    d.spectator_market_id,
    d.stake,
    d.accepted_at
  from public.duels d
  join public.markets m on m.id = d.market_id
  join public.markets sm on sm.id = d.spectator_market_id and sm.status = 'open'
  left join public.profiles pc on pc.id = d.challenger_id
  left join public.profiles po on po.id = d.opponent_id
  where d.status = 'accepted'
    and d.spectator_market_id is not null
  order by d.accepted_at desc nulls last
  limit greatest(1, least(p_limit, 30));
$$;

revoke execute on function public.get_active_spectator_duels(int) from public;
grant  execute on function public.get_active_spectator_duels(int) to authenticated;

-- Extend duel list RPCs with spectator_market_id (must drop first — return type changed).
drop function if exists public.get_open_duels(int);
drop function if exists public.get_my_duels(int);

create or replace function public.get_open_duels(p_limit int default 20)
returns table (
  id                   uuid,
  challenger_id        uuid,
  challenger_name      text,
  opponent_id          uuid,
  opponent_name        text,
  market_id            uuid,
  market_question      text,
  challenger_side      public.trade_side,
  stake                bigint,
  status               text,
  created_at           timestamptz,
  expires_at           timestamptz,
  spectator_market_id  uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    d.id,
    d.challenger_id,
    coalesce(pc.display_name, 'Anonymous'),
    d.opponent_id,
    po.display_name,
    d.market_id,
    left(m.question, 120),
    d.challenger_side,
    d.stake,
    d.status,
    d.created_at,
    d.expires_at,
    d.spectator_market_id
  from public.duels d
  join public.markets m on m.id = d.market_id
  left join public.profiles pc on pc.id = d.challenger_id
  left join public.profiles po on po.id = d.opponent_id
  where d.status = 'pending'
    and d.expires_at > now()
    and m.status = 'open'
  order by d.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.get_my_duels(p_limit int default 30)
returns table (
  id                   uuid,
  challenger_id        uuid,
  challenger_name      text,
  opponent_id          uuid,
  opponent_name        text,
  market_id            uuid,
  market_question      text,
  challenger_side      public.trade_side,
  opponent_side        public.trade_side,
  stake                bigint,
  status               text,
  winner_id            uuid,
  created_at           timestamptz,
  accepted_at          timestamptz,
  settled_at           timestamptz,
  spectator_market_id  uuid
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;

  return query
    select
      d.id,
      d.challenger_id,
      coalesce(pc.display_name, 'Anonymous'),
      d.opponent_id,
      coalesce(po.display_name, 'Anonymous'),
      d.market_id,
      left(m.question, 120),
      d.challenger_side,
      d.opponent_side,
      d.stake,
      d.status,
      d.winner_id,
      d.created_at,
      d.accepted_at,
      d.settled_at,
      d.spectator_market_id
    from public.duels d
    join public.markets m on m.id = d.market_id
    left join public.profiles pc on pc.id = d.challenger_id
    left join public.profiles po on po.id = d.opponent_id
    where d.challenger_id = v_user_id or d.opponent_id = v_user_id
    order by d.created_at desc
    limit greatest(1, least(p_limit, 50));
end;
$$;

revoke execute on function public.get_open_duels(int) from public;
grant  execute on function public.get_open_duels(int) to authenticated;
revoke execute on function public.get_my_duels(int) from public;
grant  execute on function public.get_my_duels(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Guild weekly quest — collective 50k VIBE volume → 250 VIBE per member
-- ---------------------------------------------------------------------------
create or replace function public.get_guild_quest_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id   uuid := auth.uid();
  v_guild_id  uuid;
  v_week      date := public._week_start(now());
  v_volume    bigint := 0;
  v_target    bigint := 50000;
  v_reward    bigint := 250;
  v_claimed   boolean := false;
  v_enabled   boolean := false;
begin
  if v_user_id is null then return jsonb_build_object('skipped', true); end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'guild_weekly_quest_enabled'),
    false
  ) into v_enabled;

  if not v_enabled then
    return jsonb_build_object('enabled', false);
  end if;

  select gm.guild_id into v_guild_id
    from public.guild_members gm
   where gm.user_id = v_user_id;

  if v_guild_id is null then
    return jsonb_build_object('enabled', true, 'in_guild', false);
  end if;

  select case when g.volume_week_start = v_week then g.weekly_volume else 0 end
    into v_volume
    from public.guilds g
   where g.id = v_guild_id;

  select exists(
    select 1 from public.guild_weekly_quest_claims c
     where c.guild_id = v_guild_id
       and c.user_id = v_user_id
       and c.week_start = v_week
  ) into v_claimed;

  return jsonb_build_object(
    'enabled', true,
    'in_guild', true,
    'week_start', v_week,
    'target_volume', v_target,
    'current_volume', coalesce(v_volume, 0),
    'completed', coalesce(v_volume, 0) >= v_target,
    'claimed', v_claimed,
    'reward_vibe', v_reward
  );
end;
$$;

revoke execute on function public.get_guild_quest_status() from public;
grant  execute on function public.get_guild_quest_status() to authenticated;

create or replace function public.claim_guild_quest_reward()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_guild_id  uuid;
  v_week      date := public._week_start(now());
  v_volume    bigint := 0;
  v_target    bigint := 50000;
  v_reward    bigint := 250;
  v_wallet    uuid;
  v_mint      uuid;
  v_tx_id     uuid;
  v_enabled   boolean := false;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select coalesce(
    (select enabled from public.feature_flags where key = 'guild_weekly_quest_enabled'),
    false
  ) into v_enabled;
  if not v_enabled then raise exception 'guild weekly quest is disabled'; end if;

  select gm.guild_id into v_guild_id
    from public.guild_members gm
   where gm.user_id = v_user_id;
  if v_guild_id is null then raise exception 'join a guild first'; end if;

  select case when g.volume_week_start = v_week then g.weekly_volume else 0 end
    into v_volume
    from public.guilds g
   where g.id = v_guild_id;

  if coalesce(v_volume, 0) < v_target then
    raise exception 'guild needs % VIBE volume this week (at %)', v_target, coalesce(v_volume, 0);
  end if;

  if exists(
    select 1 from public.guild_weekly_quest_claims
     where guild_id = v_guild_id and user_id = v_user_id and week_start = v_week
  ) then
    raise exception 'already claimed this week';
  end if;

  select id into v_wallet from public.accounts
   where owner_user_id = v_user_id and kind = 'user_wallet' and currency = 'vibe';
  if v_wallet is null then raise exception 'wallet not found'; end if;

  select id into v_mint from public.accounts
   where kind = 'system_mint' and currency = 'vibe' and code = 'platform_mint';
  if v_mint is null then raise exception 'platform mint missing'; end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'guild_quest_reward',
    'guild_quest:' || v_guild_id::text || ':' || v_user_id::text || ':' || v_week::text,
    jsonb_build_object('guild_id', v_guild_id, 'week_start', v_week, 'reward', v_reward),
    v_user_id
  ) returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
    (v_tx_id, v_mint, -v_reward, 'vibe'),
    (v_tx_id, v_wallet, v_reward, 'vibe');

  insert into public.guild_weekly_quest_claims (guild_id, user_id, week_start)
  values (v_guild_id, v_user_id, v_week);

  return jsonb_build_object('ok', true, 'reward_vibe', v_reward);
end;
$$;

revoke execute on function public.claim_guild_quest_reward() from public;
grant  execute on function public.claim_guild_quest_reward() to authenticated;

-- ---------------------------------------------------------------------------
-- Creator dashboard v2 — top markets + recurring series rows
-- ---------------------------------------------------------------------------
create or replace function public.get_creator_top_markets(
  p_user_id uuid default null,
  p_limit   int default 8
)
returns table (
  market_id    uuid,
  question     text,
  status       public.market_status,
  volume       bigint,
  fee_earned   bigint,
  is_recurring boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if v_user_id is null then return; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select
      m.id,
      left(m.question, 140),
      m.status,
      coalesce(sum(abs(t.cost)), 0)::bigint as volume,
      0::bigint as fee_earned,
      (m.recurring_series_id is not null) as is_recurring
    from public.markets m
    left join public.trades t on t.market_id = m.id
   where m.creator_id = v_user_id
   group by m.id, m.question, m.status, m.recurring_series_id, m.created_at
   order by volume desc, m.created_at desc
   limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function public.get_creator_top_markets(uuid, int) from public;
grant  execute on function public.get_creator_top_markets(uuid, int) to authenticated;

create or replace function public.get_creator_recurring_series(
  p_user_id uuid default null,
  p_limit   int default 10
)
returns table (
  series_id        uuid,
  title            text,
  fast_asset       text,
  interval_sec     int,
  enabled          boolean,
  windows_spawned  int,
  creator_fee_bps  int
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
begin
  if v_user_id is null then return; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select
      r.id,
      r.title,
      r.fast_asset,
      r.interval_sec,
      r.enabled,
      r.windows_spawned,
      r.creator_fee_bps
    from public.recurring_market_series r
   where r.creator_id = v_user_id
   order by r.created_at desc
   limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function public.get_creator_recurring_series(uuid, int) from public;
grant  execute on function public.get_creator_recurring_series(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, description)
values
  ('duel_spectator_markets_enabled', false, 'Spawn a spectator CPMM market when a duel is accepted'),
  ('guild_weekly_quest_enabled', false, 'Guild collective 50k VIBE/week quest with member rewards')
on conflict (key) do update
  set description = excluded.description;
