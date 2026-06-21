-- =============================================================================
-- Phase 4 (part 1 of 2): Enum value additions
-- =============================================================================
-- Same Postgres 55P04 trap as migration 8: a brand-new enum value can't be
-- used in the same transaction it's added. Split into its own file. Tiny,
-- idempotent, run BEFORE 20260109000001_categorical_markets.sql.
--
-- NOTE: `market_kind` is a NEW type (CREATE TYPE), not a value-add on an
-- existing enum, so it WOULD be safe in the same transaction. We put it here
-- anyway to keep the "enums first" pattern consistent. The cost is zero.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'market_kind') then
    create type public.market_kind as enum ('binary', 'categorical');
  end if;
end$$;

-- New ledger transaction kinds used in the categorical RPCs. The `kind`
-- column on ledger_transactions is text (not an enum), so no DDL needed here
-- — this is just a declaration for grep-ability:
--   'categorical_buy'        — buy LMSR shares
--   'categorical_resolve'    — payout winning outcome

-- New event types used in event_queue (also free-form text):
--   'categorical_resolution_proposed'
--   'categorical_market_resolved'
