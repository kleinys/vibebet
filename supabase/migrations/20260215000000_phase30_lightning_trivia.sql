-- =============================================================================
-- Phase 30: Lightning Duel (BTC 60s up/down) + Trivia Blitz
-- =============================================================================

-- —— Lightning Duel ——
create table if not exists public.lightning_duels (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  opponent_id   uuid references auth.users(id) on delete set null,
  stake         bigint not null check (stake >= 10 and stake <= 10000),
  creator_side  text not null check (creator_side in ('up', 'down')),
  asset         text not null default 'btc' check (asset in ('btc')),
  duration_sec  int not null default 60 check (duration_sec between 30 and 300),
  status        text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled', 'expired')),
  strike_price  numeric,
  end_price     numeric,
  winner_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '1 hour'),
  started_at    timestamptz,
  ends_at       timestamptz,
  settled_at    timestamptz
);

create index if not exists lightning_duels_open_idx
  on public.lightning_duels (status, created_at desc) where status = 'open';

create index if not exists lightning_duels_active_idx
  on public.lightning_duels (status, ends_at) where status = 'active';

alter table public.lightning_duels enable row level security;

drop policy if exists lightning_duels_select on public.lightning_duels;
create policy lightning_duels_select on public.lightning_duels
  for select to authenticated
  using (
    creator_id = auth.uid()
    or opponent_id = auth.uid()
    or status = 'open'
    or status = 'active'
  );

create or replace function public._lightning_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'lightning_escrow:' || p_id::text; $$;

create or replace function public.create_lightning_duel(
  p_side         text,
  p_stake        bigint,
  p_duration_sec int default 60
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_side not in ('up', 'down') then raise exception 'pick up or down'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;
  if p_duration_sec not between 30 and 300 then raise exception 'duration 30–300 seconds'; end if;

  insert into public.lightning_duels (creator_id, stake, creator_side, duration_sec)
  values (v_user_id, p_stake, p_side, p_duration_sec)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'lightning_create', 'lightning:' || v_id::text,
    public._lightning_escrow_code(v_id),
    jsonb_build_object('lightning_duel_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.accept_lightning_duel(
  p_duel_id   uuid,
  p_btc_price numeric
) returns void
language plpgsql
security definer
set search_path = ''
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

  perform public._debit_wallet_to_escrow(
    v_user_id, v_duel.stake, 'lightning_accept', 'lightning_accept:' || p_duel_id::text,
    public._lightning_escrow_code(p_duel_id),
    jsonb_build_object('lightning_duel_id', p_duel_id)
  );

  update public.lightning_duels set
    opponent_id = v_user_id,
    status = 'active',
    strike_price = p_btc_price,
    started_at = now(),
    ends_at = now() + make_interval(secs => v_duel.duration_sec)
  where id = p_duel_id;
end;
$$;

create or replace function public.cancel_lightning_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
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

  update public.lightning_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public._settle_lightning_duel(
  p_duel_id   uuid,
  p_btc_price numeric
) returns void
language plpgsql
security definer
set search_path = ''
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

  if v_up_wins is null then
    v_winner_id := null;
  elsif v_up_wins and v_duel.creator_side = 'up' then
    v_winner_id := v_duel.creator_id;
  elsif v_up_wins and v_duel.creator_side = 'down' then
    v_winner_id := v_duel.opponent_id;
  elsif not v_up_wins and v_duel.creator_side = 'down' then
    v_winner_id := v_duel.creator_id;
  else
    v_winner_id := v_duel.opponent_id;
  end if;

  v_pool := v_duel.stake * 2;
  v_payout := floor(v_pool * 0.9)::bigint;

  select id into v_escrow from public.accounts
   where kind = 'system_burn' and currency = 'vibe'
     and code = public._lightning_escrow_code(p_duel_id);

  if v_escrow is null then
    update public.lightning_duels set status = 'settled', end_price = p_btc_price, settled_at = now()
    where id = p_duel_id;
    return;
  end if;

  if v_winner_id is not null then
    select public._wallet_for_user(v_winner_id) into v_winner_wallet;
    select id into v_mint from public.accounts
     where kind = 'system_mint' and currency = 'vibe' and code = 'vibe_mint';

    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values (
      'lightning_settle', 'lightning_settle:' || p_duel_id::text,
      jsonb_build_object('lightning_duel_id', p_duel_id, 'winner_id', v_winner_id,
        'strike', v_duel.strike_price, 'end', p_btc_price),
      v_winner_id
    ) returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

    perform public._apply_game_rating('lightning', v_winner_id,
      case when v_winner_id = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end, false);
  else
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('lightning_draw', 'lightning_draw:' || p_duel_id::text,
      jsonb_build_object('lightning_duel_id', p_duel_id), v_duel.creator_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.opponent_id), v_duel.stake, 'vibe');

    perform public._apply_game_rating('lightning', v_duel.creator_id, v_duel.opponent_id, true);
  end if;

  update public.lightning_duels set
    status = 'settled',
    end_price = p_btc_price,
    winner_id = v_winner_id,
    settled_at = now()
  where id = p_duel_id;
end;
$$;

create or replace function public.tick_lightning_duels(p_btc_price numeric)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel record;
  v_count int := 0;
begin
  for v_duel in
    select id from public.lightning_duels
    where status = 'active' and ends_at <= now()
    limit 50
  loop
    perform public._settle_lightning_duel(v_duel.id, p_btc_price);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.get_open_lightning_duels(p_limit int default 20)
returns table (
  id           uuid,
  creator_id   uuid,
  creator_name text,
  stake        bigint,
  creator_side text,
  duration_sec int,
  created_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.creator_side, d.duration_sec, d.created_at
  from public.lightning_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.get_lightning_duel(p_duel_id uuid)
returns table (
  id            uuid,
  creator_id    uuid,
  creator_name  text,
  opponent_id   uuid,
  opponent_name text,
  stake         bigint,
  creator_side  text,
  duration_sec  int,
  status        text,
  strike_price  numeric,
  end_price     numeric,
  winner_id     uuid,
  started_at    timestamptz,
  ends_at       timestamptz,
  settled_at    timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    d.id, d.creator_id,
    coalesce(pc.display_name, 'Player') as creator_name,
    d.opponent_id,
    coalesce(po.display_name, 'Player') as opponent_name,
    d.stake, d.creator_side, d.duration_sec, d.status,
    d.strike_price, d.end_price, d.winner_id,
    d.started_at, d.ends_at, d.settled_at
  from public.lightning_duels d
  left join public.profiles pc on pc.id = d.creator_id
  left join public.profiles po on po.id = d.opponent_id
  where d.id = p_duel_id;
$$;

-- —— Trivia ——
create table if not exists public.trivia_questions (
  id             uuid primary key default gen_random_uuid(),
  category       text not null default 'general',
  question       text not null,
  options        jsonb not null,
  correct_index  int not null check (correct_index between 0 and 3),
  is_active      boolean not null default true
);

create table if not exists public.trivia_duels (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references auth.users(id) on delete cascade,
  opponent_id      uuid references auth.users(id) on delete set null,
  stake            bigint not null check (stake >= 10 and stake <= 10000),
  status           text not null default 'open'
    check (status in ('open', 'active', 'settled', 'cancelled')),
  question_ids     uuid[],
  creator_answers  int[],
  opponent_answers int[],
  creator_score    int,
  opponent_score   int,
  winner_id        uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '1 hour'),
  settled_at       timestamptz
);

create index if not exists trivia_duels_open_idx
  on public.trivia_duels (status, created_at desc) where status = 'open';

alter table public.trivia_questions enable row level security;
alter table public.trivia_duels enable row level security;

drop policy if exists trivia_questions_select on public.trivia_questions;
create policy trivia_questions_select on public.trivia_questions
  for select to authenticated using (is_active = true);

drop policy if exists trivia_duels_select on public.trivia_duels;
create policy trivia_duels_select on public.trivia_duels
  for select to authenticated
  using (creator_id = auth.uid() or opponent_id = auth.uid() or status = 'open');

create or replace function public._trivia_escrow_code(p_id uuid)
returns text language sql immutable as $$ select 'trivia_escrow:' || p_id::text; $$;

insert into public.trivia_questions (category, question, options, correct_index) values
  ('crypto', 'What does BTC stand for?', '["Bitcoin", "Blockchain Token", "Binary Trade Coin", "Bank Transfer Credit"]'::jsonb, 0),
  ('crypto', 'Which network is SOL native to?', '["Solana", "Ethereum", "Polygon", "Avalanche"]'::jsonb, 0),
  ('crypto', 'What is a prediction market?', '["Betting on event outcomes", "Stock exchange", "Mining pool", "NFT gallery"]'::jsonb, 0),
  ('sports', 'How many players on a basketball team on court?', '["5", "6", "7", "11"]'::jsonb, 0),
  ('sports', 'The FIFA World Cup is held every ___ years.', '["4", "2", "3", "5"]'::jsonb, 0),
  ('general', 'What is 7 × 8?', '["56", "54", "64", "48"]'::jsonb, 0),
  ('general', 'Capital of Japan?', '["Tokyo", "Seoul", "Beijing", "Osaka"]'::jsonb, 0),
  ('general', 'How many continents?', '["7", "5", "6", "8"]'::jsonb, 0),
  ('science', 'Speed of light is approximately ___ km/s.', '["300,000", "150,000", "30,000", "3,000"]'::jsonb, 0),
  ('science', 'H2O is commonly known as?', '["Water", "Hydrogen", "Oxygen", "Salt"]'::jsonb, 0),
  ('crypto', 'ETH is the native token of?', '["Ethereum", "EOS", "Elrond", "Ergo"]'::jsonb, 0),
  ('general', '2 + 2 × 2 = ?', '["6", "8", "4", "10"]'::jsonb, 0),
  ('sports', 'Tennis scoring: love means?', '["Zero", "One", "Deuce", "Win"]'::jsonb, 0),
  ('crypto', 'A stablecoin is designed to?', '["Hold stable value", "Mine faster", "Replace Bitcoin", "Pay gas only"]'::jsonb, 0),
  ('general', 'Largest planet in our solar system?', '["Jupiter", "Saturn", "Neptune", "Earth"]'::jsonb, 0);

create or replace function public.create_trivia_duel(p_stake bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_stake < 10 or p_stake > 10000 then raise exception 'stake must be 10–10,000 VIBE'; end if;

  insert into public.trivia_duels (creator_id, stake)
  values (v_user_id, p_stake)
  returning id into v_id;

  perform public._debit_wallet_to_escrow(
    v_user_id, p_stake, 'trivia_create', 'trivia:' || v_id::text,
    public._trivia_escrow_code(v_id),
    jsonb_build_object('trivia_duel_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.accept_trivia_duel(p_duel_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
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

  select array_agg(id order by random()) into v_qids
  from (select id from public.trivia_questions where is_active = true order by random() limit 5) sub;

  if v_qids is null or array_length(v_qids, 1) < 5 then
    raise exception 'not enough trivia questions in database';
  end if;

  perform public._debit_wallet_to_escrow(
    v_user_id, v_duel.stake, 'trivia_accept', 'trivia_accept:' || p_duel_id::text,
    public._trivia_escrow_code(p_duel_id),
    jsonb_build_object('trivia_duel_id', p_duel_id)
  );

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_duel          public.trivia_duels%rowtype;
  v_qid           uuid;
  v_idx           int;
  v_correct       int;
  v_c_score       int := 0;
  v_o_score       int := 0;
  v_winner_id     uuid;
  v_pool          bigint;
  v_payout        bigint;
  v_winner_wallet uuid;
  v_mint          uuid;
  v_escrow        uuid;
  v_tx_id         uuid;
  v_i             int;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_answers is null or array_length(p_answers, 1) <> 5 then
    raise exception 'submit exactly 5 answers (0–3)';
  end if;

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
        'creator_score', v_c_score, 'opponent_score', v_o_score),
      v_winner_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, v_winner_wallet, v_payout, 'vibe'),
      (v_tx_id, v_mint, v_pool - v_payout, 'vibe');

    perform public._apply_game_rating('trivia', v_winner_id,
      case when v_winner_id = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end, false);
  else
    insert into public.ledger_transactions (kind, external_ref, metadata, created_by)
    values ('trivia_draw', 'trivia_draw:' || p_duel_id::text,
      jsonb_build_object('trivia_duel_id', p_duel_id), v_duel.creator_id)
    returning id into v_tx_id;

    insert into public.ledger_entries (transaction_id, account_id, amount, currency) values
      (v_tx_id, v_escrow, -v_pool, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.creator_id), v_duel.stake, 'vibe'),
      (v_tx_id, public._wallet_for_user(v_duel.opponent_id), v_duel.stake, 'vibe');

    perform public._apply_game_rating('trivia', v_duel.creator_id, v_duel.opponent_id, true);
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
language plpgsql
security definer
set search_path = ''
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

  update public.trivia_duels set status = 'cancelled' where id = p_duel_id;
end;
$$;

create or replace function public.get_open_trivia_duels(p_limit int default 20)
returns table (
  id           uuid,
  creator_id   uuid,
  creator_name text,
  stake        bigint,
  created_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.creator_id,
    coalesce(p.display_name, 'Player') as creator_name,
    d.stake, d.created_at
  from public.trivia_duels d
  left join public.profiles p on p.id = d.creator_id
  where d.status = 'open' and d.expires_at > now()
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.get_trivia_questions_for_duel(p_duel_id uuid)
returns table (
  question_id   uuid,
  question      text,
  options       jsonb,
  question_num  int
)
language sql stable security definer set search_path = ''
as $$
  select
    q.id as question_id,
    q.question,
    q.options,
    ordinality::int as question_num
  from public.trivia_duels d
  cross join lateral unnest(d.question_ids) with ordinality as u(qid, ordinality)
  join public.trivia_questions q on q.id = u.qid
  where d.id = p_duel_id
    and d.status in ('active', 'settled')
    and (d.creator_id = auth.uid() or d.opponent_id = auth.uid())
  order by ordinality;
$$;

revoke execute on function public.create_lightning_duel(text, bigint, int) from public;
grant execute on function public.create_lightning_duel(text, bigint, int) to authenticated;
revoke execute on function public.accept_lightning_duel(uuid, numeric) from public;
grant execute on function public.accept_lightning_duel(uuid, numeric) to authenticated;
revoke execute on function public.cancel_lightning_duel(uuid) from public;
grant execute on function public.cancel_lightning_duel(uuid) to authenticated;
revoke execute on function public.tick_lightning_duels(numeric) from public;
grant execute on function public.tick_lightning_duels(numeric) to authenticated;
revoke execute on function public.get_open_lightning_duels(int) from public;
grant execute on function public.get_open_lightning_duels(int) to authenticated;
revoke execute on function public.get_lightning_duel(uuid) from public;
grant execute on function public.get_lightning_duel(uuid) to authenticated;
revoke execute on function public.create_trivia_duel(bigint) from public;
grant execute on function public.create_trivia_duel(bigint) to authenticated;
revoke execute on function public.accept_trivia_duel(uuid) from public;
grant execute on function public.accept_trivia_duel(uuid) to authenticated;
revoke execute on function public.submit_trivia_answers(uuid, int[]) from public;
grant execute on function public.submit_trivia_answers(uuid, int[]) to authenticated;
revoke execute on function public.cancel_trivia_duel(uuid) from public;
grant execute on function public.cancel_trivia_duel(uuid) to authenticated;
revoke execute on function public.get_open_trivia_duels(int) from public;
grant execute on function public.get_open_trivia_duels(int) to authenticated;
revoke execute on function public.get_trivia_questions_for_duel(uuid) from public;
grant execute on function public.get_trivia_questions_for_duel(uuid) to authenticated;

insert into public.feature_flags (key, enabled, description)
values ('trivia_enabled', false, 'Trivia Blitz head-to-head at /games/duels/trivia')
on conflict (key) do update set description = excluded.description;
