-- =============================================================================
-- Phase 3 (part 1 of 2): Enum value additions
-- =============================================================================
-- Postgres rule: a new enum value added with ALTER TYPE ... ADD VALUE cannot
-- be used (e.g. in WHERE clauses, indexes, function bodies) within the SAME
-- transaction that adds it. Because the Supabase SQL Editor wraps each script
-- in a single transaction, we must split this off into its own file.
--
-- Run this file FIRST. It's tiny and idempotent.
-- Then run 20260108000001_meme_court.sql in a separate execution.
-- =============================================================================

alter type public.market_status add value if not exists 'resolving';
alter type public.market_status add value if not exists 'in_court';

alter type public.notification_kind add value if not exists 'resolution_proposed';
alter type public.notification_kind add value if not exists 'dispute_opened';
alter type public.notification_kind add value if not exists 'dispute_resolved';
