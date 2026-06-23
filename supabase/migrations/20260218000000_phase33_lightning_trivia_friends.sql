-- =============================================================================
-- Phase 33: Lightning + Trivia friend invites / friendly zero-stake
-- =============================================================================

alter table public.lightning_duels drop constraint if exists lightning_duels_stake_check;
alter table public.lightning_duels add constraint lightning_duels_stake_check check (
  (is_friendly and stake = 0)
  or (not is_friendly and stake >= 10 and stake <= 10000)
);

alter table public.trivia_duels drop constraint if exists trivia_duels_stake_check;
alter table public.trivia_duels add constraint trivia_duels_stake_check check (
  (is_friendly and stake = 0)
  or (not is_friendly and stake >= 10 and stake <= 10000)
);

drop function if exists public.create_lightning_duel(text, bigint, int);
drop function if exists public.get_open_lightning_duels(int);
drop function if exists public.create_trivia_duel(bigint);
drop function if exists public.get_open_trivia_duels(int);

create or replace function public.create_lightning_duel(
  p_side         text,
  p_stake        bigint,
  p_duration_sec int default 60,
  p_invite_code  text default null,
  p_friendly     boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_invited  uuid;
  v_id       uuid;
  v_friendly boolean := coalesce(p_friendly, false);
  v_stake    bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_side not in ('up', 'down') then raise exception 'pick up or down'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;
  if p_duration_sec not between 30 and 300 then raise exception 'duration 30–300 seconds'; end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.lightning_duels (creator_id, stake, creator_side, duration_sec, invited_user_id, is_friendly)
  values (v_user_id, v_stake, p_side, p_duration_sec, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'lightning_create', 'lightning:' || v_id::text,
      public._lightning_escrow_code(v_id),
      jsonb_build_object('lightning_duel_id', v_id)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.accept_lightning_duel(
  p_duel_id   uuid,
  p_btc_price numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.lightning_duels%rowtype;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_btc_price is null or p_btc_price <= 0 then raise exception 'invalid btc price'; end if;

  select * into v_duel from public.lightning_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel not open'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot join your own duel'; end if;
  if v_duel.invited_user_id is not null and v_duel.invited_user_id <> v_user_id then
    raise exception 'this duel is reserved for another player';
  end if;

  if v_duel.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_duel.stake, 'lightning_accept', 'lightning_accept:' || p_duel_id::text,
      public._lightning_escrow_code(p_duel_id),
      jsonb_build_object('lightning_duel_id', p_duel_id)
    );
  end if;

  update public.lightning_duels set
    opponent_id = v_user_id,
    status = 'active',
    strike_price = p_btc_price,
    started_at = now(),
    ends_at = now() + make_interval(secs => v_duel.duration_sec)
  where id = p_duel_id;
end;
$$;

create or replace function public._settle_lightning_duel(
  p_duel_id   uuid,
  p_btc_price numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_duel          public.lightning_duels%rowtype;
  v_winner_id     uuid;
  v_up_wins       boolean;
  v_pool          bigint;
  v_payout        bigint;
  v_winner_wallet uuid;
  v_mint          uuid;
  v_escrow        uuid;
  v_tx_id         uuid;
begin
  select * into v_duel from public.lightning_duels where id = p_duel_id for update;
  if not found or v_duel.status <> 'active' then return; end if;
  if v_duel.ends_at > now() then return; end if;
  if p_btc_price is null or p_btc_price <= 0 then return; end if;

  if p_btc_price > v_duel.strike_price then v_up_wins := true;
  elsif p_btc_price < v_duel.strike_price then v_up_wins := false;
  else v_up_wins := null;
  end if;

  if v_up_wins is null then v_winner_id := null;
  elsif v_up_wins and v_duel.creator_side = 'up' then v_winner_id := v_duel.creator_id;
  elsif v_up_wins and v_duel.creator_side = 'down' then v_winner_id := v_duel.opponent_id;
  elsif not v_up_wins and v_duel.creator_side = 'down' then v_winner_id := v_duel.creator_id;
  else v_winner_id := v_duel.opponent_id;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  if v_duel.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._lightning_escrow_code(p_duel_id);

    if v_escrow is not null then
      if v_winner_id is not null then
        select public._wallet_for_user(v_winner_id) into v_winner_wallet;
        select id into v_mint from public.accounts
         where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

        insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
        values ('lightning_settle', 'lightning_settle:' || p_duel_id::text,
          jsonb_build_object('lightning_duel_id', p_duel_id, 'winner_id', v_winner_id,
            'strike', v_duel.strike_price, 'end', p_btc_price), v_winner_id)
        returning id into v_tx_id;

        insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
          (v_tx_id, v_escrow, -v_pool, 'vibe'),
          (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
          (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
      else
        insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
        values ('lightning_draw', 'lightning_draw:' || p_duel_id::text,
          jsonb_build_object('lightning_duel_id', p_duel_id), v_duel.creator_id)
        returning id into v_tx_id;

        insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
          (v_tx_id, v_escrow, -v_pool, 'vibe'),
          (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
          (v_tx_id, public._wallet_for_user(v_duel.opponent_id), v_duel.stake, 'vibe');
      end if;
    end if;
  end if;

  if not v_duel.is_friendly then
    if v_winner_id is not null then
      perform public._apply_game_rating('lightning', v_winner_id,
        case when v_winner_id = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end, false);
    else
      perform public._apply_game_rating('lightning', v_duel.creator_id, v_duel.opponent_id, true);
    end if;
  end if;

  update public.lightning_duels set
    status = 'settled', end_price = p_btc_price, winner_id = v_winner_id, settled_at = now()
  where id = p_duel_id;
end;
$$;

create or replace function public.cancel_lightning_duel(p_duel_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.lightning_duels%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_duel from public.lightning_duels where id = p_duel_id for update;
  if not found or v_duel.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_duel.status <> 'open' then raise exception 'not open'; end if;

  if v_duel.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._lightning_escrow_code(p_duel_id);
    select public._wallet_for_user(v_duel.creator_id) into v_wallet;

    if v_escrow is not null and v_wallet is not null then
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('lightning_cancel', 'lightning_cancel:' || p_duel_id::text,
        jsonb_build_object('lightning_duel_id', p_duel_id), v_user_id)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_duel.stake, 'vibe'),
        (v_tx_id, v_wallet, v_duel.stake, 'vibe');
    end if;
  end if;

  update public.lightning_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_lightning_duels(p_limit int default 20)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  stake           bigint,
  is_friendly     boolean,
  invited_user_id uuid,
  creator_side    text,
  duration_sec    int,
  created_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.is_friendly, d.invited_user_id, d.creator_side, d.duration_sec, d.created_at
  from public.lightning_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
    and (d.invited_user_id is null or d.invited_user_id = auth.uid())
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.create_trivia_duel(
  p_stake       bigint,
  p_invite_code text default null,
  p_friendly    boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_invited  uuid;
  v_id       uuid;
  v_friendly boolean := coalesce(p_friendly, false);
  v_stake    bigint;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  v_stake := case when v_friendly then 0 else p_stake end;
  if not v_friendly and (v_stake < 10 or v_stake > 10000) then
    raise exception 'stake must be 10–10,000 VIBE';
  end if;

  v_invited := public._resolve_invited_user(p_invite_code);

  insert into public.trivia_duels (creator_id, stake, invited_user_id, is_friendly)
  values (v_user_id, v_stake, v_invited, v_friendly)
  returning id into v_id;

  if v_stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_stake, 'trivia_create', 'trivia:' || v_id::text,
      public._trivia_escrow_code(v_id),
      jsonb_build_object('trivia_duel_id', v_id)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.accept_trivia_duel(p_duel_id uuid)
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.trivia_duels%rowtype;
  v_qids    uuid[];
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;

  select * into v_duel from public.trivia_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'open' then raise exception 'duel not open'; end if;
  if v_duel.creator_id = v_user_id then raise exception 'cannot join your own duel'; end if;
  if v_duel.invited_user_id is not null and v_duel.invited_user_id <> v_user_id then
    raise exception 'this duel is reserved for another player';
  end if;

  select array_agg(id order by random()) into v_qids
  from (select id from public.trivia_questions where is_active = true order by random() limit 5) sub;

  if v_qids is null or array_length(v_qids, 1) < 5 then
    raise exception 'not enough trivia questions in database';
  end if;

  if v_duel.stake > 0 then
    perform public._debit_wallet_to_escrow(
      v_user_id, v_duel.stake, 'trivia_accept', 'trivia_accept:' || p_duel_id::text,
      public._trivia_escrow_code(p_duel_id),
      jsonb_build_object('trivia_duel_id', p_duel_id)
    );
  end if;

  update public.trivia_duels set
    opponent_id = v_user_id,
    status = 'active',
    question_ids = v_qids
  where id = p_duel_id;

  return v_qids;
end;
$$;

create or replace function public.submit_trivia_answers(
  p_duel_id uuid,
  p_answers int[]
) returns table (
  creator_score  int,
  opponent_score int,
  winner_id      uuid,
  payout         bigint
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_duel      public.trivia_duels%rowtype;
  v_c_score   int := 0;
  v_o_score   int := 0;
  v_winner_id uuid;
  v_pool      bigint;
  v_payout    bigint;
  v_winner_wallet uuid;
  v_mint      uuid;
  v_escrow    uuid;
  v_tx_id     uuid;
  v_i         int;
  v_qid       uuid;
  v_correct   int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if array_length(p_answers, 1) <> 5 then raise exception 'need exactly 5 answers'; end if;

  select * into v_duel from public.trivia_duels where id = p_duel_id for update;
  if not found then raise exception 'duel not found'; end if;
  if v_duel.status <> 'active' then raise exception 'duel not active'; end if;

  if v_user_id = v_duel.creator_id then
    if v_duel.creator_answers is not null then raise exception 'already submitted'; end if;
    update public.trivia_duels set creator_answers = p_answers where id = p_duel_id;
    v_duel.creator_answers := p_answers;
  elsif v_user_id = v_duel.opponent_id then
    if v_duel.opponent_answers is not null then raise exception 'already submitted'; end if;
    update public.trivia_duels set opponent_answers = p_answers where id = p_duel_id;
    v_duel.opponent_answers := p_answers;
  else
    raise exception 'not a participant';
  end if;

  if v_duel.creator_answers is null or v_duel.opponent_answers is null then
    return query select null::int, null::int, null::uuid, null::bigint;
    return;
  end if;

  for v_i in 1..5 loop
    v_qid := v_duel.question_ids[v_i];
    select correct_index into v_correct from public.trivia_questions where id = v_qid;
    if v_duel.creator_answers[v_i] = v_correct then v_c_score := v_c_score + 1; end if;
    if v_duel.opponent_answers[v_i] = v_correct then v_o_score := v_o_score + 1; end if;
  end loop;

  if v_c_score > v_o_score then v_winner_id := v_duel.creator_id;
  elsif v_o_score > v_c_score then v_winner_id := v_duel.opponent_id;
  else v_winner_id := null;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  if v_duel.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._trivia_escrow_code(p_duel_id);

    if v_winner_id is not null then
      select public._wallet_for_user(v_winner_id) into v_winner_wallet;
      select id into v_mint from public.accounts
       where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('trivia_settle', 'trivia_settle:' || p_duel_id::text,
        jsonb_build_object('trivia_duel_id', p_duel_id, 'winner_id', v_winner_id,
          'creator_score', v_c_score, 'opponent_score', v_o_score), v_winner_id)
      returning id into v_tx_id;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'),
        (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
        (v_tx_id, v_mint, v_pool - v_payout, 'vibe');
    else
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('trivia_draw', 'trivia_draw:' || p_duel_id::text,
        jsonb_build_object('trivia_duel_id', p_duel_id), v_duel.creator_id)
      returning id into v_tx_id;

      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_pool, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
        (v_tx_id, public._wallet_for_user(v_duel.opponent_id), v_duel.stake, 'vibe');
    end if;
  end if;

  if not v_duel.is_friendly then
    if v_winner_id is not null then
      perform public._apply_game_rating('trivia', v_winner_id,
        case when v_winner_id = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end, false);
    else
      perform public._apply_game_rating('trivia', v_duel.creator_id, v_duel.opponent_id, true);
    end if;
  end if;

  update public.trivia_duels set
    status = 'settled',
    creator_score = v_c_score,
    opponent_score = v_o_score,
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;

  return query select v_c_score, v_o_score, v_winner_id, coalesce(v_payout, 0::bigint);
end;
$$;

create or replace function public.cancel_trivia_duel(p_duel_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel    public.trivia_duels%rowtype;
  v_escrow  uuid;
  v_wallet  uuid;
  v_tx_id   uuid;
begin
  select * into v_duel from public.trivia_duels where id = p_duel_id for update;
  if not found or v_duel.creator_id <> v_user_id then raise exception 'not yours'; end if;
  if v_duel.status <> 'open' then raise exception 'not open'; end if;

  if v_duel.stake > 0 then
    select id into v_escrow from public.accounts
     where kind = 'system_burn' and currency = 'vibe'
       and code = public._trivia_escrow_code(p_duel_id);
    select public._wallet_for_user(v_duel.creator_id) into v_wallet;

    if v_escrow is not null and v_wallet is not null then
      insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
      values ('trivia_cancel', 'trivia_cancel:' || p_duel_id::text,
        jsonb_build_object('trivia_duel_id', p_duel_id), v_user_id)
      returning id into v_tx_id;
      insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
        (v_tx_id, v_escrow, -v_duel.stake, 'vibe'),
        (v_tx_id, v_wallet, v_duel.stake, 'vibe');
    end if;
  end if;

  update public.trivia_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_trivia_duels(p_limit int default 20)
returns table (
  id              uuid,
  creator_id      uuid,
  creator_name    text,
  stake           bigint,
  is_friendly     boolean,
  invited_user_id uuid,
  created_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.is_friendly, d.invited_user_id, d.created_at
  from public.trivia_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
    and (d.invited_user_id is null or d.invited_user_id = auth.uid())
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.create_lightning_duel(text, bigint, int, text, boolean) from public;
grant execute on function public.create_lightning_duel(text, bigint, int, text, boolean) to authenticated;
revoke execute on function public.get_open_lightning_duels(int) from public;
grant execute on function public.get_open_lightning_duels(int) to authenticated;
revoke execute on function public.create_trivia_duel(bigint, text, boolean) from public;
grant execute on function public.create_trivia_duel(bigint, text, boolean) to authenticated;
revoke execute on function public.get_open_trivia_duels(int) from public;
grant execute on function public.get_open_trivia_duels(int) to authenticated;
