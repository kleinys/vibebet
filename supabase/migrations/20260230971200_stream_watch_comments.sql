-- Stream watch chat comments (per stream room).

create table if not exists public.stream_watch_comments (
  id                  uuid primary key default gen_random_uuid(),
  stream_provider     text not null,
  stream_external_id  text not null,
  user_id             uuid not null references auth.users(id) on delete cascade,
  body                text not null check (char_length(body) between 1 and 500),
  created_at          timestamptz not null default now()
);

create index if not exists stream_watch_comments_stream_idx
  on public.stream_watch_comments (stream_provider, stream_external_id, created_at desc);

alter table public.stream_watch_comments enable row level security;

drop policy if exists stream_watch_comments_select on public.stream_watch_comments;
create policy stream_watch_comments_select on public.stream_watch_comments
  for select to authenticated, anon using (true);

drop policy if exists stream_watch_comments_insert on public.stream_watch_comments;
create policy stream_watch_comments_insert on public.stream_watch_comments
  for insert to authenticated with check (user_id = auth.uid());

create or replace function public.get_stream_watch_comments(
  p_provider    text,
  p_external_id text,
  p_limit       int default 40
) returns table (
  id           uuid,
  body         text,
  author_name  text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.body,
    coalesce(p.display_name, 'Viewer'),
    c.created_at
  from public.stream_watch_comments c
  left join public.profiles p on p.id = c.user_id
  where c.stream_provider = lower(trim(p_provider))
    and c.stream_external_id = trim(p_external_id)
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 80));
$$;

revoke all on function public.get_stream_watch_comments(text, text, int) from public;
grant execute on function public.get_stream_watch_comments(text, text, int) to authenticated, anon;
