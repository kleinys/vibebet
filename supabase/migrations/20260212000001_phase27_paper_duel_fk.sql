-- Optional FK when phase 23 (paper_duels) is already applied.
do $$
begin
  if to_regclass('public.paper_duels') is not null
     and not exists (
       select 1 from pg_constraint
        where conname = 'live_events_paper_duel_id_fkey'
     ) then
    alter table public.live_events
      add constraint live_events_paper_duel_id_fkey
      foreign key (paper_duel_id) references public.paper_duels(id) on delete set null;
  end if;
end;
$$;
