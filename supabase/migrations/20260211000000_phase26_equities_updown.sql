-- =============================================================================
-- Phase 26: Equities Up/Down — curated stocks on the fast-market engine
-- =============================================================================

insert into public.fast_market_slots (asset, interval_sec, label, category) values
  ('aapl', 900, 'Apple', 'finance'),
  ('tsla', 900, 'Tesla', 'finance'),
  ('nvda', 900, 'NVIDIA', 'finance')
on conflict do nothing;

-- Only spawn equity windows during US regular session (Mon–Fri 14:30–21:00 UTC).
create or replace function public._us_equity_session_open()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    extract(isodow from (now() at time zone 'America/New_York')) between 1 and 5
    and (now() at time zone 'America/New_York')::time >= time '09:30'
    and (now() at time zone 'America/New_York')::time <  time '16:00';
$$;

create or replace function public.record_fast_market_tick(p_prices jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item          jsonb;
  v_asset         text;
  v_price         numeric;
  v_bot_id        uuid;
  v_market        record;
  v_outcome       boolean;
  v_resolved      int := 0;
  v_spawned       int := 0;
  v_slot          record;
  v_has_open      boolean;
  v_equity_open   boolean;
begin
  v_equity_open := public._us_equity_session_open();

  select (value #>> '{}')::uuid into v_bot_id
    from public.app_config where key = 'platform_bot_user_id';
  if v_bot_id is null then
    select id into v_bot_id from auth.users
     where (raw_app_meta_data->>'role') = 'admin'
     order by created_at asc limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb))
  loop
    v_asset := lower(trim(v_item->>'asset'));
    v_price := (v_item->>'price')::numeric;
    if v_asset is null or v_price is null or v_price <= 0 then continue; end if;

    insert into public.asset_price_ticks (asset, price_usd)
    values (v_asset, v_price);

    for v_market in
      select id, strike_price, window_end
        from public.markets
       where fast_asset = v_asset
         and status = 'open'
         and window_end is not null
         and window_end <= now()
       for update
    loop
      v_outcome := v_price >= v_market.strike_price;
      update public.markets
         set resolve_price = v_price,
             proposed_outcome = v_outcome
       where id = v_market.id;
      perform public.finalize_market_internal(v_market.id, v_outcome);
      v_resolved := v_resolved + 1;
    end loop;
  end loop;

  delete from public.asset_price_ticks
   where recorded_at < now() - interval '2 hours';

  if v_bot_id is null then
    return jsonb_build_object('resolved', v_resolved, 'spawned', v_spawned);
  end if;

  for v_slot in select * from public.fast_market_slots
  loop
    if v_slot.category = 'finance' and not v_equity_open then
      continue;
    end if;

    select exists(
      select 1 from public.markets
       where fast_asset = v_slot.asset
         and fast_interval_sec = v_slot.interval_sec
         and status = 'open'
         and window_end > now()
    ) into v_has_open;

    if not v_has_open then
      select (elem->>'price')::numeric into v_price
        from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) elem
       where lower(trim(elem->>'asset')) = v_slot.asset
       limit 1;

      if v_price is not null and v_price > 0 then
        perform public._spawn_fast_market(
          v_bot_id,
          v_slot.asset,
          v_slot.interval_sec,
          v_slot.label,
          v_slot.category,
          v_price,
          now(),
          now() + (v_slot.interval_sec || ' seconds')::interval
        );
        v_spawned := v_spawned + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('resolved', v_resolved, 'spawned', v_spawned);
end;
$$;

insert into public.feature_flags (key, enabled, description)
values (
  'equities_enabled',
  false,
  'Equities Up/Down: AAPL, TSLA, NVDA 15m windows during US market hours (same fast engine as crypto).'
)
on conflict (key) do update set description = excluded.description;
