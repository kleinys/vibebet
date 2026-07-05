-- Hotfix: _ensure_system_account must cast text params to enum types.
-- Run in Supabase SQL Editor if vs-bot / locker wheel fails with:
--   operator does not exist: account_kind = text

create or replace function public._ensure_system_account(
  p_kind text,
  p_currency text,
  p_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.accounts
  where kind = p_kind::account_kind and currency = p_currency::currency and code = p_code;

  if v_id is not null then return v_id; end if;

  begin
    insert into public.accounts (kind, currency, code)
    values (p_kind::account_kind, p_currency::currency, p_code)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id
    from public.accounts
    where kind = p_kind::account_kind and currency = p_currency::currency and code = p_code;
  end;

  return v_id;
end;
$$;

revoke all on function public._ensure_system_account(text, text, text) from public;
