-- =============================================================================
-- Phase 2.7: Notifications + Event Queue
-- =============================================================================
-- Two new tables and a simple event-processing pattern. Notifications are
-- delivered "synchronously" — the resolve and comment-insert paths enqueue
-- an event, then immediately call `process_event_queue` inline. No cron or
-- realtime channel required.
--
-- Design choices:
--   * `notifications` has a `dedupe_key` column with a UNIQUE constraint per
--     user. The processor uses `ON CONFLICT DO NOTHING` so repeated events
--     (e.g. a retry, an admin re-resolve) never duplicate a user's inbox.
--   * `event_queue` has NO RLS policies — only SECURITY DEFINER functions
--     touch it, so direct client access is blocked entirely by RLS.
--   * `notifications` has SELECT + UPDATE RLS for the row owner (so users
--     can mark their own notifications read). All INSERTs happen through
--     `process_event_queue` (SECURITY DEFINER), never from client code.
--   * Comments use an AFTER INSERT TRIGGER to enqueue events — no changes
--     to client-side comment-insertion code required.
--   * Resolve uses an explicit INSERT-and-PERFORM inside `resolve_market`
--     because that function already runs as SECURITY DEFINER.
-- =============================================================================

create type public.notification_kind as enum (
  'bet_won',          -- a market resolved in your favor
  'bet_lost',         -- a market you held resolved against you
  'market_resolved',  -- generic resolution notification (fallback)
  'market_commented', -- someone commented on a market you created
  'comment_reply',    -- (reserved for future threaded replies)
  'streak_at_risk'    -- (reserved for future streak system)
);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null check (length(title) between 1 and 200),
  body        text,
  -- Structured data the UI uses to render a deep link (market_id, comment_id…)
  data        jsonb not null default '{}'::jsonb,
  -- Stable per (logical event, user). Prevents accidental double-delivery.
  -- Examples: 'market_resolved:<market_id>', 'market_commented:<comment_id>'.
  dedupe_key  text not null check (length(dedupe_key) between 1 and 200),
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- A user can read their own notifications.
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- A user can mark their own notifications as read (UPDATE is_read + read_at).
-- The WITH CHECK forbids changing ownership.
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT or DELETE policy — both go through SECURITY DEFINER functions.

-- -----------------------------------------------------------------------------
-- event_queue
-- -----------------------------------------------------------------------------
create table public.event_queue (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null check (length(event_type) between 1 and 50),
  payload       jsonb not null,
  status        text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  attempts      int  not null default 0 check (attempts >= 0),
  error_message text,
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index event_queue_pending_idx
  on public.event_queue (created_at)
  where status = 'pending';

alter table public.event_queue enable row level security;
-- Deliberately no policies: only SECURITY DEFINER functions and the
-- service-role bypass touch this table. Direct client access is blocked.

-- =============================================================================
-- RPC: mark_notifications_read
--   Pass null to mark all of caller's notifications read; pass an array of
--   ids to mark only those.
-- =============================================================================
create or replace function public.mark_notifications_read(
  p_notification_ids uuid[] default null
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count   int;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if p_notification_ids is null then
    update public.notifications
       set is_read = true, read_at = now()
     where user_id = v_user_id
       and is_read = false;
  else
    update public.notifications
       set is_read = true, read_at = now()
     where user_id = v_user_id
       and id = any(p_notification_ids)
       and is_read = false;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public;
grant  execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- =============================================================================
-- RPC: unread_notification_count
--   Fast count of caller's unread notifications (for the header badge).
-- =============================================================================
create or replace function public.unread_notification_count()
returns int
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int
  from public.notifications
  where user_id = (select auth.uid())
    and is_read = false;
$$;

revoke execute on function public.unread_notification_count() from public;
grant  execute on function public.unread_notification_count() to authenticated;

-- =============================================================================
-- RPC: process_event_queue
--   Drains up to p_limit pending events, creates notifications, marks them
--   completed. Failures are caught and the event is flipped to 'failed' with
--   the SQL error stored in error_message. Idempotent via the unique
--   (user_id, dedupe_key) constraint on notifications.
-- =============================================================================
create or replace function public.process_event_queue(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event     record;
  v_processed int := 0;
  v_payload   jsonb;
  v_market_id uuid;
  v_outcome   boolean;
  v_question  text;
  v_yes_lbl   text;
  v_no_lbl    text;
  v_outcome_label text;
begin
  for v_event in
    select * from public.event_queue
     where status = 'pending'
     order by created_at asc
     limit greatest(1, least(p_limit, 500))
     for update skip locked
  loop
    begin
      v_payload := v_event.payload;

      if v_event.event_type = 'market_resolved' then
        v_market_id := (v_payload->>'market_id')::uuid;
        v_outcome   := (v_payload->>'outcome')::boolean;
        v_question  := coalesce(v_payload->>'question', 'a market');
        v_yes_lbl   := coalesce(v_payload->>'yes_label', 'Yes');
        v_no_lbl    := coalesce(v_payload->>'no_label', 'No');
        v_outcome_label := case when v_outcome then v_yes_lbl else v_no_lbl end;

        -- One notification per holder. The CASE picks won/lost based on which
        -- side they actually held shares of.
        insert into public.notifications
          (user_id, kind, title, body, data, dedupe_key)
        select
          p.user_id,
          case
            when v_outcome     and p.yes_shares > 0 then 'bet_won'::public.notification_kind
            when not v_outcome and p.no_shares  > 0 then 'bet_won'::public.notification_kind
            else 'bet_lost'::public.notification_kind
          end,
          case
            when (v_outcome and p.yes_shares > 0) or (not v_outcome and p.no_shares > 0)
              then 'You won: ' || v_question
            else
              'Resolved against you: ' || v_question
          end,
          'Outcome: ' || v_outcome_label,
          jsonb_build_object(
            'market_id', v_market_id,
            'outcome', v_outcome
          ),
          'market_resolved:' || v_market_id::text
        from public.positions p
        where p.market_id = v_market_id
          and (p.yes_shares > 0 or p.no_shares > 0)
        on conflict (user_id, dedupe_key) do nothing;

      elsif v_event.event_type = 'market_commented' then
        -- Notify the market creator. Skipped if creator is the commenter
        -- (the trigger already filtered that case, but double-check here).
        if (v_payload->>'market_creator_id') is not null
           and (v_payload->>'commenter_id') is not null
           and (v_payload->>'market_creator_id') <> (v_payload->>'commenter_id')
        then
          insert into public.notifications
            (user_id, kind, title, body, data, dedupe_key)
          values (
            (v_payload->>'market_creator_id')::uuid,
            'market_commented',
            'New comment on your market',
            left(coalesce(v_payload->>'body', ''), 160),
            jsonb_build_object(
              'market_id', v_payload->>'market_id',
              'comment_id', v_payload->>'comment_id'
            ),
            'market_commented:' || (v_payload->>'comment_id')
          )
          on conflict (user_id, dedupe_key) do nothing;
        end if;
      end if;

      update public.event_queue
         set status = 'completed', processed_at = now()
       where id = v_event.id;

      v_processed := v_processed + 1;

    exception when others then
      update public.event_queue
         set status = 'failed',
             attempts = attempts + 1,
             error_message = sqlerrm,
             processed_at = now()
       where id = v_event.id;
    end;
  end loop;

  return v_processed;
end;
$$;

revoke execute on function public.process_event_queue(int) from public;
-- Note: NOT granted to authenticated. Only callers from inside other
-- SECURITY DEFINER functions (or the service role) can invoke this.

-- =============================================================================
-- Trigger: enqueue market_commented event on every comment insert.
-- =============================================================================
create or replace function public.market_comments_enqueue_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator  uuid;
  v_question text;
begin
  select creator_id, question
    into v_creator, v_question
    from public.markets
   where id = new.market_id;

  -- Self-comment: skip enqueueing entirely.
  if v_creator is null or v_creator = new.user_id then
    return new;
  end if;

  insert into public.event_queue (event_type, payload) values (
    'market_commented',
    jsonb_build_object(
      'comment_id', new.id,
      'market_id', new.market_id,
      'market_question', v_question,
      'market_creator_id', v_creator,
      'commenter_id', new.user_id,
      'body', new.body
    )
  );

  -- Drain inline. Failure of the processor is swallowed (it doesn't raise)
  -- so a notification glitch can't block the comment insert.
  perform public.process_event_queue(10);

  return new;
end;
$$;

drop trigger if exists market_comments_enqueue_event_trg on public.market_comments;
create trigger market_comments_enqueue_event_trg
  after insert on public.market_comments
  for each row execute function public.market_comments_enqueue_event();

-- =============================================================================
-- Patch: resolve_market now enqueues a `market_resolved` event and drains
-- the queue inline before returning.
-- =============================================================================
create or replace function public.resolve_market(
  p_market_id uuid,
  p_outcome   boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller        uuid := auth.uid();
  v_is_admin      boolean;
  v_market        public.markets%rowtype;
  v_market_pool   uuid;
  v_burn_account  uuid;
  v_tx_id         uuid;
  v_position      record;
  v_user_wallet   uuid;
  v_payout        bigint;
  v_pool_balance  bigint;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    into v_is_admin;
  if not v_is_admin then
    raise exception 'admin only';
  end if;

  select * into v_market from public.markets
   where id = p_market_id
   for update;

  if not found then raise exception 'market not found'; end if;
  if v_market.status = 'resolved' then raise exception 'market already resolved'; end if;
  if v_market.status = 'voided'  then raise exception 'market is voided'; end if;

  select id into v_market_pool
    from public.accounts
   where kind = 'system_burn'
     and currency = 'vibe'
     and code = 'market_pool:' || p_market_id::text;

  if v_market_pool is null then
    raise exception 'market pool account missing';
  end if;

  insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
  values (
    'market_resolve',
    'market_resolve:' || p_market_id::text,
    jsonb_build_object('market_id', p_market_id, 'outcome', p_outcome),
    v_caller
  )
  returning id into v_tx_id;

  for v_position in
    select user_id, yes_shares, no_shares from public.positions
     where market_id = p_market_id
       and (
         (p_outcome     and yes_shares > 0)
         or
         (not p_outcome and no_shares  > 0)
       )
  loop
    v_payout := case when p_outcome then v_position.yes_shares else v_position.no_shares end;

    select id into v_user_wallet
      from public.accounts
     where owner_user_id = v_position.user_id
       and kind = 'user_wallet'
       and currency = 'vibe';

    if v_user_wallet is null then
      raise exception 'wallet missing for user %', v_position.user_id;
    end if;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_user_wallet, v_payout,  'vibe'),
      (v_tx_id, v_market_pool, -v_payout, 'vibe');

    update public.positions
       set total_payout = total_payout + v_payout
     where market_id = p_market_id
       and user_id = v_position.user_id;
  end loop;

  -- Burn residual.
  select coalesce(sum(amount), 0) into v_pool_balance
    from public.ledger_entries
   where account_id = v_market_pool;

  if v_pool_balance > 0 then
    select id into v_burn_account
      from public.accounts
     where kind = 'system_burn'
       and currency = 'vibe'
       and code = 'market_residual_burn';

    if v_burn_account is null then
      insert into public.accounts (kind, currency, code)
      values ('system_burn', 'vibe', 'market_residual_burn')
      returning id into v_burn_account;
    end if;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_market_pool,  -v_pool_balance, 'vibe'),
      (v_tx_id, v_burn_account,  v_pool_balance, 'vibe');
  end if;

  update public.markets
     set status            = 'resolved',
         resolved_outcome  = p_outcome,
         resolved_at       = now()
   where id = p_market_id;

  -- NEW in Phase 2.7: enqueue + drain.
  insert into public.event_queue (event_type, payload) values (
    'market_resolved',
    jsonb_build_object(
      'market_id', p_market_id,
      'outcome',   p_outcome,
      'question',  v_market.question,
      'yes_label', v_market.outcome_yes_label,
      'no_label',  v_market.outcome_no_label
    )
  );

  perform public.process_event_queue(200);
end;
$$;
