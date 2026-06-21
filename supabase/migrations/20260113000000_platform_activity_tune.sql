-- =============================================================================
-- Phase 4.6 tune: gentler bot + auto-bootstrap official catalog
-- =============================================================================
-- Changes:
--   1. Bot no longer trades polymarket_mirror markets (odds stay synced to PM).
--   2. Smaller, less frequent synthetic trades on official + quiet community.
--   3. bootstrap_market_catalog() auto-seeds official markets when catalog is thin.
-- =============================================================================

-- Internal seed (same rows as admin_seed_official_markets, no admin JWT).
create or replace function public._seed_official_markets_internal(p_creator_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_seed  record;
begin
  if p_creator_id is null then return 0; end if;

  for v_seed in
    select * from (values
      ('Will Bitcoin exceed $150k before Jan 1, 2027?'::text,
       'crypto'::public.market_category, 0.42::numeric, 5000::bigint,
       'Above $150k'::text, 'Below $150k'::text, true),
      ('Will the Fed cut rates at least twice in 2026?',
       'finance', 0.58, 4000, 'Yes', 'No', true),
      ('Will SpaceX Starship reach orbit successfully in 2026?',
       'tech', 0.72, 3500, 'Yes', 'No', false),
      ('Will a major AI lab release GPT-5 or equivalent in 2026?',
       'tech', 0.65, 4500, 'Yes', 'No', true),
      ('Will Ethereum flip Bitcoin market cap in 2026?',
       'crypto', 0.08, 3000, 'Yes', 'No', false),
      ('US recession declared before 2027?',
       'finance', 0.22, 4000, 'Yes', 'No', false),
      ('Will Ukraine and Russia agree to a ceasefire in 2026?',
       'world', 0.35, 5000, 'Yes', 'No', true),
      ('Will Trump win the 2028 US presidential election?',
       'politics', 0.48, 6000, 'Yes', 'No', true),
      ('Will Apple announce a foldable iPhone in 2026?',
       'tech', 0.18, 2500, 'Yes', 'No', false),
      ('Will GTA VI release before July 2026?',
       'entertainment', 0.12, 5000, 'Yes', 'No', true),
      ('Will Solana exceed $500 in 2026?',
       'crypto', 0.25, 3500, 'Above $500', 'Below $500', false),
      ('Will the Lakers win the 2026 NBA championship?',
       'sports', 0.15, 3000, 'Yes', 'No', false),
      ('Oscar Best Picture: sci-fi film wins in 2027?',
       'entertainment', 0.20, 2000, 'Yes', 'No', false),
      ('Will global temperatures set a new record in 2026?',
       'world', 0.78, 2500, 'Yes', 'No', false),
      ('Will TikTok be banned in the US in 2026?',
       'culture', 0.30, 3500, 'Yes', 'No', false)
    ) as t(question, category, yes_price, subsidy, yes_label, no_label, featured)
  loop
    if exists (
      select 1 from public.markets
       where source = 'platform' and question = v_seed.question
    ) then
      continue;
    end if;

    perform public._create_platform_market(
      p_creator_id,
      v_seed.question,
      'Official Vibebet market — play money only.',
      v_seed.subsidy,
      v_seed.yes_price,
      now() + interval '180 days',
      v_seed.category,
      v_seed.yes_label,
      v_seed.no_label,
      'platform'::public.market_source,
      v_seed.featured,
      null, null, null, null, null
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public._seed_official_markets_internal(uuid) from public;

-- Auto-seed official markets when catalog is thin (no admin JWT needed).
create or replace function public.bootstrap_market_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator        uuid;
  v_platform_count int;
  v_mirror_count   int;
  v_seeded         int := 0;
begin
  select (value #>> '{}')::uuid into v_creator
    from public.app_config where key = 'platform_bot_user_id';
  if v_creator is null then
    select id into v_creator from auth.users
     where (raw_app_meta_data->>'role') = 'admin'
     order by created_at asc limit 1;
  end if;

  select count(*)::int into v_platform_count
    from public.markets where source = 'platform' and status = 'open';
  select count(*)::int into v_mirror_count
    from public.markets where source = 'polymarket_mirror' and status = 'open';

  if v_creator is not null and v_platform_count < 5 then
    v_seeded := public._seed_official_markets_internal(v_creator);
  end if;

  return jsonb_build_object(
    'seeded', v_seeded,
    'platform_count', v_platform_count,
    'mirror_count', v_mirror_count
  );
end;
$$;

revoke execute on function public.bootstrap_market_catalog() from public;
grant  execute on function public.bootstrap_market_catalog() to authenticated, anon;

-- Gentler synthetic activity: keep Polymarket mirrors at synced odds.
create or replace function public.platform_activity_tick(p_limit int default 3)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bot_id   uuid;
  v_market   record;
  v_count    int := 0;
  v_side     public.trade_side;
  v_cost     bigint;
  v_max      int;
begin
  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then return 0; end if;

  v_max := greatest(1, least(coalesce(p_limit, 2), 5));
  perform public._fund_platform_bot(2000);

  -- Official markets: tiny trades for light volume / chart activity.
  for v_market in
    select m.id, m.reserve_yes, m.reserve_no
      from public.markets m
     where m.status = 'open'
       and m.kind = 'binary'
       and m.source = 'platform'
       and not exists (
         select 1 from public.trades t
          where t.market_id = m.id
            and t.user_id = v_bot_id
            and t.created_at > now() - interval '2 hours'
       )
     order by random()
     limit v_max
  loop
    begin
      v_side := case when random() < 0.5 then 'yes' else 'no' end;
      v_cost := (5 + floor(random() * 11))::bigint;  -- 5–15 VIBE
      perform public.place_trade_for_user(v_market.id, v_bot_id, v_side, v_cost);
      v_count := v_count + 1;
    exception when others then
      null;
    end;
  end loop;

  -- Quiet community markets: at most one tiny trade if still empty.
  if v_count < v_max then
    for v_market in
      select m.id
        from public.markets m
        left join lateral (
          select count(*)::int as trade_count
            from public.trades t where t.market_id = m.id
        ) tc on true
       where m.status = 'open'
         and m.kind = 'binary'
         and m.source = 'community'
         and coalesce(tc.trade_count, 0) = 0
       order by m.created_at desc
       limit 1
    loop
      begin
        v_side := case when random() < 0.5 then 'yes' else 'no' end;
        v_cost := 8;
        perform public.place_trade_for_user(v_market.id, v_bot_id, v_side, v_cost);
        v_count := v_count + 1;
      exception when others then
        null;
      end;
    end loop;
  end if;

  return v_count;
end;
$$;

-- Patch admin seed to use internal helper.
create or replace function public.admin_seed_official_markets()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then raise exception 'admin only'; end if;
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  return public._seed_official_markets_internal(auth.uid());
end;
$$;
