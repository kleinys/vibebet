-- =============================================================================
-- Phase 4.7: Reliable Polymarket mirror sync + catalog stats
-- =============================================================================
-- Fixes empty home page when mirrors haven't been created yet:
--   • refresh_polymarket_mirrors skips rate limit when mirror count = 0
--   • Admin can force refresh via p_force = true
--   • get_market_catalog_stats() for admin dashboard
-- =============================================================================

create or replace function public.refresh_polymarket_mirrors(
  p_payload jsonb,
  p_force     boolean default false
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last          timestamptz;
  v_mirror_count  int;
  v_item          jsonb;
  v_count         int := 0;
  v_admin_id      uuid;
  v_market_id     uuid;
begin
  select count(*)::int into v_mirror_count
    from public.markets
   where source = 'polymarket_mirror';

  if not p_force and v_mirror_count > 0 then
    select (value #>> '{}')::timestamptz into v_last
      from public.app_config where key = 'polymarket_last_sync';
    if v_last is not null and v_last > now() - interval '15 minutes' then
      return 0;
    end if;
  end if;

  select (value #>> '{}')::uuid into v_admin_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_admin_id is null then
    select id into v_admin_id from auth.users
     where (raw_app_meta_data->>'role') = 'admin'
     order by created_at asc limit 1;
  end if;
  if v_admin_id is null then return 0; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb))
  loop
    begin
      v_market_id := public._upsert_polymarket_mirror_internal(
        v_admin_id,
        v_item->>'external_id',
        left(v_item->>'question', 280),
        left(coalesce(v_item->>'description', ''), 2000),
        (v_item->>'yes_price')::numeric,
        nullif(v_item->>'closes_at', '')::timestamptz,
        coalesce(v_item->>'category', 'other'),
        coalesce(v_item->>'yes_label', 'Yes'),
        coalesce(v_item->>'no_label', 'No'),
        v_item->>'external_url',
        nullif(v_item->>'external_vol', '')::numeric,
        nullif(v_item->>'external_vol_24h', '')::numeric,
        v_item->>'image_url'
      );
      if v_market_id is not null then v_count := v_count + 1; end if;
    exception when others then
      null;
    end;
  end loop;

  insert into public.app_config (key, value, updated_at)
  values ('polymarket_last_sync', to_jsonb(now()::text), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return v_count;
end;
$$;

revoke execute on function public.refresh_polymarket_mirrors(jsonb, boolean) from public;
grant  execute on function public.refresh_polymarket_mirrors(jsonb, boolean) to authenticated, anon;

create or replace function public.get_market_catalog_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_platform  int;
  v_mirror    int;
  v_community int;
  v_categorical int;
  v_bot       uuid;
  v_last_sync timestamptz;
begin
  select count(*)::int into v_platform
    from public.markets where source = 'platform' and status = 'open';
  select count(*)::int into v_mirror
    from public.markets where source = 'polymarket_mirror' and status = 'open';
  select count(*)::int into v_community
    from public.markets where source = 'community' and status = 'open';
  select count(*)::int into v_categorical
    from public.markets where kind = 'categorical' and status = 'open';

  select (value #>> '{}')::uuid into v_bot
    from public.app_config where key = 'platform_bot_user_id';
  select (value #>> '{}')::timestamptz into v_last_sync
    from public.app_config where key = 'polymarket_last_sync';

  return jsonb_build_object(
    'platform', v_platform,
    'polymarket_mirror', v_mirror,
    'community', v_community,
    'categorical', v_categorical,
    'bot_registered', v_bot is not null,
    'last_polymarket_sync', v_last_sync
  );
end;
$$;

revoke execute on function public.get_market_catalog_stats() from public;
grant  execute on function public.get_market_catalog_stats() to authenticated, anon;
