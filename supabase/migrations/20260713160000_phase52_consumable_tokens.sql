-- Phase 52: Consumable token inventory (adrenaline_token prep for cross-mode rewards)

create table if not exists public.user_consumables (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  quantity int not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.user_consumables enable row level security;

create policy "user_consumables_select_own"
  on public.user_consumables for select
  using (auth.uid() = user_id);

create policy "user_consumables_update_own"
  on public.user_consumables for update
  using (auth.uid() = user_id);

create index if not exists user_consumables_user_id_idx
  on public.user_consumables (user_id);

comment on table public.user_consumables is
  'Stackable cross-mode tokens (e.g. adrenaline_token from duel wins). Grants via service role / RPC only for now.';
