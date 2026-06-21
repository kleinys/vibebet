-- =============================================================================
-- Phase 18: PWA install shell + browser push notifications
-- =============================================================================

alter table public.profiles
  add column if not exists push_notifications_enabled boolean not null default false;

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.push_outbox (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  unique (notification_id)
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (user_id, status, created_at)
  where status = 'pending';

alter table public.push_outbox enable row level security;

-- Users can see their own outbox rows (optional debug); delivery is server-side.
drop policy if exists push_outbox_select_own on public.push_outbox;
create policy push_outbox_select_own on public.push_outbox
  for select to authenticated using (user_id = auth.uid());

create or replace function public._enqueue_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.push_notifications_enabled
  ) then
    return new;
  end if;

  insert into public.push_outbox (notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_push on public.notifications;
create trigger notifications_enqueue_push
  after insert on public.notifications
  for each row execute function public._enqueue_push_outbox();

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent;

  update public.profiles
  set push_notifications_enabled = true
  where id = auth.uid();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public;
grant  execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions
  where user_id = auth.uid() and endpoint = p_endpoint;

  if not exists (
    select 1 from public.push_subscriptions s where s.user_id = auth.uid()
  ) then
    update public.profiles
    set push_notifications_enabled = false
    where id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.remove_push_subscription(text) from public;
grant  execute on function public.remove_push_subscription(text) to authenticated;

create or replace function public.set_push_notifications_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set push_notifications_enabled = coalesce(p_enabled, false)
  where id = auth.uid();

  if not coalesce(p_enabled, false) then
    delete from public.push_subscriptions where user_id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.set_push_notifications_enabled(boolean) from public;
grant  execute on function public.set_push_notifications_enabled(boolean) to authenticated;

-- Pending push jobs for the signed-in user (delivered by Next.js API).
create or replace function public.get_pending_push_jobs(p_limit int default 20)
returns table (
  outbox_id uuid,
  notification_id uuid,
  title text,
  body text,
  url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id as outbox_id,
    n.id as notification_id,
    n.title,
    coalesce(n.body, '') as body,
    case
      when n.data ? 'dispute_id' and n.data->>'dispute_id' is not null
        then '/court/' || (n.data->>'dispute_id')
      when n.data ? 'market_id' and n.data->>'market_id' is not null
        then '/markets/' || (n.data->>'market_id')
      else '/account/notifications'
    end as url
  from public.push_outbox o
  join public.notifications n on n.id = o.notification_id
  where o.user_id = auth.uid()
    and o.status = 'pending'
  order by o.created_at asc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.get_pending_push_jobs(int) from public;
grant  execute on function public.get_pending_push_jobs(int) to authenticated;

create or replace function public.mark_push_job(
  p_outbox_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox
  set
    status = p_status,
    attempts = attempts + 1,
    last_error = p_error,
    delivered_at = case when p_status = 'sent' then now() else delivered_at end
  where id = p_outbox_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.mark_push_job(uuid, text, text) from public;
grant  execute on function public.mark_push_job(uuid, text, text) to authenticated;

insert into public.feature_flags (key, enabled, description)
values
  ('pwa_enabled', false, 'Web app manifest + Add to Home Screen prompt'),
  ('push_notifications_enabled', false, 'Browser push for in-app notification events')
on conflict (key) do update set description = excluded.description;
