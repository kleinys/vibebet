-- =============================================================================
-- Phase 16: Mobile-first UX (bottom nav, safe areas)
-- =============================================================================

insert into public.feature_flags (key, enabled, description)
values ('mobile_nav_enabled', false, 'Sticky bottom tab bar + mobile search on small screens')
on conflict (key) do update set description = excluded.description;
