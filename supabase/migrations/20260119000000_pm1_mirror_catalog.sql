-- =============================================================================
-- PM-1: Polymarket mirror catalog scale + event grouping
-- =============================================================================
-- • Store PM event metadata (id, slug, title) and tag labels on mirror rows
-- • Upsert helper accepts event fields; refresh_polymarket_mirrors passes them
-- • get_mirror_catalog_sidebar() for Polymarket-style category / event counts
-- =============================================================================

alter table public.markets
  add column if not exists external_event_id text,
  add column if not exists external_event_slug text,
  add column if not exists external_event_title text,
  add column if not exists external_tags jsonb not null default '[]'::jsonb;

create index if not exists markets_mirror_event_slug_idx
  on public.markets (external_event_slug)
  where source = 'polymarket_mirror' and external_event_slug is not null;

create index if not exists markets_mirror_category_open_idx
  on public.markets (category)
  where source = 'polymarket_mirror' and status = 'open';

-- Drop old signature before replacing with extended params.
drop function if exists public._upsert_polymarket_mirror_internal(
  uuid, text, text, text, numeric, timestamptz, text, text, text, text, numeric, numeric, text
);

create or replace function public._upsert_polymarket_mirror_internal(
  p_creator_id            uuid,
  p_external_id           text,
  p_question              text,
  p_description           text,
  p_yes_price             numeric,
  p_closes_at             timestamptz,
  p_category              text,
  p_yes_label             text,
  p_no_label              text,
  p_external_url          text,
  p_external_vol          numeric,
  p_external_vol_24h      numeric,
  p_image_url             text,
  p_external_event_id     text default null,
  p_external_event_slug   text default null,
  p_external_event_title  text default null,
  p_external_tags         jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id  uuid;
  v_cat        public.market_category;
  v_res_yes    bigint;
  v_res_no     bigint;
  v_subsidy    bigint := 5000;
  v_pool_total bigint := v_subsidy * 2;
begin
  if p_external_id is null or length(trim(p_external_id)) = 0 then
    raise exception 'external_id required';
  end if;

  v_cat := case p_category
    when 'politics' then 'politics'::public.market_category
    when 'sports' then 'sports'::public.market_category
    when 'crypto' then 'crypto'::public.market_category
    when 'tech' then 'tech'::public.market_category
    when 'entertainment' then 'entertainment'::public.market_category
    when 'finance' then 'finance'::public.market_category
    when 'world' then 'world'::public.market_category
    when 'culture' then 'culture'::public.market_category
    else 'other'::public.market_category
  end;

  select id into v_market_id from public.markets where external_id = p_external_id;

  select r.reserve_yes, r.reserve_no into v_res_yes, v_res_no
    from public.cpmm_reserves_for_yes_price(v_pool_total, p_yes_price) r;

  if v_market_id is null then
    v_market_id := public._create_platform_market(
      p_creator_id,
      left(p_question, 280),
      left(coalesce(p_description, ''), 2000),
      v_subsidy, p_yes_price, p_closes_at, v_cat,
      coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
      coalesce(nullif(trim(p_no_label), ''), 'No'),
      'polymarket_mirror'::public.market_source,
      false, p_external_id, p_external_url,
      p_external_vol, p_external_vol_24h, p_image_url
    );
  else
    update public.markets
       set question = left(p_question, 280),
           description = left(coalesce(p_description, ''), 2000),
           reserve_yes = v_res_yes, reserve_no = v_res_no,
           closes_at = coalesce(p_closes_at, closes_at),
           category = v_cat,
           outcome_yes_label = coalesce(nullif(trim(p_yes_label), ''), outcome_yes_label),
           outcome_no_label = coalesce(nullif(trim(p_no_label), ''), outcome_no_label),
           image_url = coalesce(p_image_url, image_url),
           external_url = p_external_url,
           external_volume_usd = p_external_vol,
           external_volume_24h_usd = p_external_vol_24h,
           external_synced_at = now()
     where id = v_market_id;
  end if;

  update public.markets
     set external_event_id = nullif(trim(p_external_event_id), ''),
         external_event_slug = nullif(trim(p_external_event_slug), ''),
         external_event_title = nullif(left(trim(coalesce(p_external_event_title, '')), 200), ''),
         external_tags = coalesce(p_external_tags, '[]'::jsonb)
   where id = v_market_id;

  return v_market_id;
end;
$$;

revoke execute on function public._upsert_polymarket_mirror_internal(
  uuid, text, text, text, numeric, timestamptz, text, text, text, text, numeric, numeric, text,
  text, text, text, jsonb
) from public;

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
        v_item->>'image_url',
        v_item->>'external_event_id',
        v_item->>'external_event_slug',
        v_item->>'external_event_title',
        coalesce(v_item->'external_tags', '[]'::jsonb)
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

-- Sidebar stats: category counts + top PM events by open mirror count.
create or replace function public.get_mirror_catalog_sidebar()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with open_mirrors as (
    select *
      from public.markets
     where source = 'polymarket_mirror'
       and status = 'open'
       and kind = 'binary'
  ),
  cat_counts as (
    select category::text as category, count(*)::int as count
      from open_mirrors
     group by category
     order by count desc
  ),
  event_counts as (
    select
      external_event_slug as slug,
      max(external_event_title) as title,
      count(*)::int as market_count,
      coalesce(sum(external_volume_24h_usd), 0)::numeric as volume_24h_usd
      from open_mirrors
     where external_event_slug is not null
     group by external_event_slug
     order by volume_24h_usd desc nulls last, market_count desc
     limit 24
  )
  select jsonb_build_object(
    'total_open', (select count(*)::int from open_mirrors),
    'categories', coalesce(
      (select jsonb_agg(jsonb_build_object('category', category, 'count', count))
         from cat_counts),
      '[]'::jsonb
    ),
    'events', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'slug', slug,
         'title', title,
         'market_count', market_count,
         'volume_24h_usd', volume_24h_usd
       ))
         from event_counts),
      '[]'::jsonb
    )
  );
$$;

revoke execute on function public.get_mirror_catalog_sidebar() from public;
grant  execute on function public.get_mirror_catalog_sidebar() to authenticated, anon;
