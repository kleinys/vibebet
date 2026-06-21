-- =============================================================================
-- Fix market_category enum — add ALL category values
-- =============================================================================
-- Errors like:
--   invalid input value for enum public.market_category: 'finance'
--   invalid input value for enum public.market_category: 'tech'
-- mean the enum exists but is missing values. Add every value the app uses.
--
-- Run once in Supabase SQL Editor, then Admin → Populate everything.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'market_category') then
    create type public.market_category as enum (
      'politics',
      'sports',
      'crypto',
      'tech',
      'entertainment',
      'finance',
      'world',
      'culture',
      'other'
    );
  end if;
end $$;

-- Add each value idempotently (safe to re-run entire block).
alter type public.market_category add value if not exists 'politics';
alter type public.market_category add value if not exists 'sports';
alter type public.market_category add value if not exists 'crypto';
alter type public.market_category add value if not exists 'tech';
alter type public.market_category add value if not exists 'entertainment';
alter type public.market_category add value if not exists 'finance';
alter type public.market_category add value if not exists 'world';
alter type public.market_category add value if not exists 'culture';
alter type public.market_category add value if not exists 'other';

-- Verify (optional — shows all enum labels after run):
-- select enumlabel from pg_enum
--  where enumtypid = 'public.market_category'::regtype
--  order by enumsortorder;
