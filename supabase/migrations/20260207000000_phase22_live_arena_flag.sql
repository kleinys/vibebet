insert into public.feature_flags (key, enabled, description)
values ('live_arena_enabled', false, 'Unified /games hub — live auto-resolved betting')
on conflict (key) do update set description = excluded.description;
