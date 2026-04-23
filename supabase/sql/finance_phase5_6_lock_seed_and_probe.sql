-- Finance phase 5/6 smoke helper
-- Date: 2026-04-23
-- Purpose:
--   1) Ensure at least one locked period exists (idempotent)
--   2) Return the exact period/date to use in API lock tests
-- Notes:
--   - Run in Supabase SQL Editor
--   - Non-destructive: only upsert in finance_closing_periods

-- 1) Upsert a locked period (current month, first day)
WITH target_period AS (
  SELECT date_trunc('month', CURRENT_DATE)::date AS period_month
)
INSERT INTO public.finance_closing_periods (
  period_month,
  status,
  closed_at,
  locked_at,
  notes,
  updated_at
)
SELECT
  tp.period_month,
  'locked',
  NOW(),
  NOW(),
  'phase5_6_smoke_lock_seed_2026_04_23',
  NOW()
FROM target_period tp
ON CONFLICT (period_month) DO UPDATE
SET
  status = 'locked',
  closed_at = COALESCE(public.finance_closing_periods.closed_at, NOW()),
  locked_at = COALESCE(public.finance_closing_periods.locked_at, NOW()),
  notes = COALESCE(public.finance_closing_periods.notes, EXCLUDED.notes),
  updated_at = NOW();

-- 2) Confirm current locked periods
SELECT
  period_month,
  status,
  to_char(period_month, 'YYYY-MM') AS period_yyyy_mm,
  to_char(period_month, 'YYYY-MM') || '-15' AS probe_date_yyyy_mm_dd,
  notes,
  updated_at
FROM public.finance_closing_periods
WHERE status = 'locked'
ORDER BY period_month DESC
LIMIT 12;
