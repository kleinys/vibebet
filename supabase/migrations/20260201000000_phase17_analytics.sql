-- =============================================================================
-- Phase 17: Analytics dashboard + PostHog-ready export
-- =============================================================================

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

-- Daily event counts for admin dashboard.
create or replace function public.get_analytics_summary(p_days int default 7)
returns table (
  event_name text,
  event_count bigint,
  unique_users bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.event_name,
    count(*)::bigint as event_count,
    count(distinct e.user_id)::bigint as unique_users
  from public.analytics_events e
  where e.created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by e.event_name
  order by event_count desc, e.event_name;
$$;

revoke execute on function public.get_analytics_summary(int) from public;
grant  execute on function public.get_analytics_summary(int) to authenticated;

-- Recent raw events (admin only via RLS on table + is_admin in caller).
create or replace function public.get_recent_analytics_events(
  p_limit int default 50,
  p_event_name text default null
)
returns table (
  id uuid,
  user_id uuid,
  event_name text,
  properties jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.user_id,
    e.event_name,
    e.properties,
    e.created_at
  from public.analytics_events e
  where public.is_admin()
    and (p_event_name is null or e.event_name = p_event_name)
  order by e.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

revoke execute on function public.get_recent_analytics_events(int, text) from public;
grant  execute on function public.get_recent_analytics_events(int, text) to authenticated;

-- CSV-friendly export blob for PostHog replay / external BI.
create or replace function public.export_analytics_events(
  p_since timestamptz default now() - interval '7 days',
  p_limit int default 5000
)
returns table (
  id uuid,
  user_id uuid,
  event_name text,
  properties jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.user_id,
    e.event_name,
    e.properties,
    e.created_at
  from public.analytics_events e
  where public.is_admin()
    and e.created_at >= coalesce(p_since, now() - interval '7 days')
  order by e.created_at asc
  limit greatest(1, least(p_limit, 50000));
$$;

revoke execute on function public.export_analytics_events(timestamptz, int) from public;
grant  execute on function public.export_analytics_events(timestamptz, int) to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('analytics_dashboard_enabled', false, 'Admin analytics summary + CSV export'),
  ('posthog_forward_enabled', false, 'Mirror track_event calls to PostHog when API key is set')
on conflict (key) do update set description = excluded.description;
