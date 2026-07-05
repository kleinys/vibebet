-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS FIRST — alone, in its own Supabase SQL Editor tab. Click Run once.
-- Wait for "Success". Do NOT combine with the pricing migration.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE public.item_kind ADD VALUE 'animal';

-- Run this in a SECOND query (new tab or after first succeeds):
-- ALTER TYPE public.item_kind ADD VALUE 'phenomenon';

-- Verify (should list skin, shield, badge, animal, phenomenon):
-- SELECT e.enumlabel FROM pg_enum e
-- JOIN pg_type t ON e.enumtypid = t.oid
-- WHERE t.typname = 'item_kind' ORDER BY e.enumsortorder;
