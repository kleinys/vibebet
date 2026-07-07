-- Stream-scoped watch bets: viewers create yes/no polls tied to a live stream.

create table if not exists public.stream_watch_bets (
  id                  uuid primary key default gen_random_uuid(),
  stream_provider     text not null check (stream_provider in ('youtube', 'twitch', 'kick', 'other')),
  stream_external_id  text not null check (char_length(stream_external_id) between 1 and 200),
  stream_title        text,
  creator_id          uuid not null references auth.users(id) on delete cascade,
  question            text not null check (char_length(question) between 8 and 240),
  yes_label           text not null default 'Yes',
  no_label            text not null default 'No',
  market_id           uuid not null references public.markets(id) on delete cascade,
  created_at          timestamptz not null default now()
);

create index if not exists stream_watch_bets_stream_idx
  on public.stream_watch_bets (stream_provider, stream_external_id, created_at desc);

create index if not exists stream_watch_bets_market_idx
  on public.stream_watch_bets (market_id);

alter table public.stream_watch_bets enable row level security;

drop policy if exists stream_watch_bets_select on public.stream_watch_bets;
create policy stream_watch_bets_select on public.stream_watch_bets
  for select to authenticated, anon using (true);

drop policy if exists stream_watch_bets_insert on public.stream_watch_bets;
create policy stream_watch_bets_insert on public.stream_watch_bets
  for insert to authenticated with check (creator_id = auth.uid());

create or replace function public.create_stream_watch_bet(
  p_provider         text,
  p_external_id      text,
  p_question         text,
  p_yes_label        text default 'Yes',
  p_no_label         text default 'No',
  p_stream_title     text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_market_id uuid;
  v_bet_id    uuid;
  v_provider  text := lower(trim(coalesce(p_provider, 'other')));
  v_external  text := trim(coalesce(p_external_id, ''));
  v_question  text := trim(coalesce(p_question, ''));
  v_recent    int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if v_provider not in ('youtube', 'twitch', 'kick', 'other') then
    v_provider := 'other';
  end if;
  if v_external = '' then raise exception 'stream id required'; end if;
  if char_length(v_question) < 8 then raise exception 'question too short (min 8 chars)'; end if;

  select count(*)::int into v_recent
  from public.stream_watch_bets
  where creator_id = v_user_id
    and stream_provider = v_provider
    and stream_external_id = v_external
    and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'max 5 stream bets per hour on this stream'; end if;

  v_market_id := public._create_platform_market(
    v_user_id,
    left(v_question, 240),
    format(
      'Stream bet on %s/%s. Resolves when the moment is clear — play-money VIBE only.',
      v_provider, v_external
    ),
    800,
    0.5,
    now() + interval '6 hours',
    'entertainment'::public.market_category,
    coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
    coalesce(nullif(trim(p_no_label), ''), 'No'),
    'community'::public.market_source,
    false,
    null, null, null, null, null
  );

  insert into public.stream_watch_bets (
    stream_provider, stream_external_id, stream_title,
    creator_id, question, yes_label, no_label, market_id
  ) values (
    v_provider,
    v_external,
    nullif(trim(coalesce(p_stream_title, '')), ''),
    v_user_id,
    left(v_question, 240),
    coalesce(nullif(trim(p_yes_label), ''), 'Yes'),
    coalesce(nullif(trim(p_no_label), ''), 'No'),
    v_market_id
  ) returning id into v_bet_id;

  return v_market_id;
end;
$$;

create or replace function public.get_stream_watch_bets(
  p_provider    text,
  p_external_id text,
  p_limit       int default 30
) returns table (
  bet_id          uuid,
  market_id       uuid,
  question        text,
  yes_label       text,
  no_label        text,
  creator_name    text,
  created_at      timestamptz,
  market_status   text,
  reserve_yes     bigint,
  reserve_no      bigint,
  yes_price       numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id,
    b.market_id,
    b.question,
    b.yes_label,
    b.no_label,
    coalesce(p.display_name, 'Viewer'),
    b.created_at,
    m.status,
    m.reserve_yes,
    m.reserve_no,
    case
      when m.reserve_yes + m.reserve_no = 0 then 0.5
      else m.reserve_no::numeric / (m.reserve_yes + m.reserve_no)::numeric
    end
  from public.stream_watch_bets b
  join public.markets m on m.id = b.market_id
  left join public.profiles p on p.id = b.creator_id
  where b.stream_provider = lower(trim(p_provider))
    and b.stream_external_id = trim(p_external_id)
    and m.status = 'open'
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.create_stream_watch_bet(text, text, text, text, text, text) from public;
grant execute on function public.create_stream_watch_bet(text, text, text, text, text, text) to authenticated;

revoke all on function public.get_stream_watch_bets(text, text, int) from public;
grant execute on function public.get_stream_watch_bets(text, text, int) to authenticated, anon;
