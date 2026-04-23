-- Finance upgrade post-snapshot upsert
-- Usage:
-- 1) Replace snapshot tag below with the current date.
-- 2) Run in Supabase SQL Editor.

INSERT INTO public.finance_migration_snapshots (
  snapshot_tag,
  total_entries,
  total_income,
  total_expense,
  net_balance,
  notes
)
SELECT
  'post_upgrade_YYYY_MM_DD',
  COUNT(*) AS total_entries,
  COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_income,
  COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_expense,
  (
    COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)
  )::NUMERIC(18,2) AS net_balance,
  'Snapshot after finance upgrade step'
FROM public.finance_entries
ON CONFLICT (snapshot_tag) DO UPDATE
SET
  total_entries = EXCLUDED.total_entries,
  total_income = EXCLUDED.total_income,
  total_expense = EXCLUDED.total_expense,
  net_balance = EXCLUDED.net_balance,
  notes = EXCLUDED.notes,
  captured_at = NOW();
