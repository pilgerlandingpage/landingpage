-- Finance upgrade integrity checklist
-- Run this file before and after each migration phase.
-- This script does not change existing finance data.

-- =========================================================
-- 1) Current baseline (read-only)
-- =========================================================

SELECT
  COUNT(*) AS total_entries,
  COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_income,
  COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_expense,
  (
    COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)
    -
    COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)
  )::NUMERIC(18,2) AS net_balance
FROM public.finance_entries;

-- =========================================================
-- 2) Save baseline snapshot (execute with your own tag)
-- Example tag: pre_upgrade_2026_04_22
-- =========================================================

-- INSERT INTO public.finance_migration_snapshots (
--   snapshot_tag,
--   total_entries,
--   total_income,
--   total_expense,
--   net_balance,
--   notes
-- )
-- SELECT
--   'pre_upgrade_2026_04_22',
--   COUNT(*) AS total_entries,
--   COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_income,
--   COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_expense,
--   (
--     COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)
--     -
--     COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)
--   )::NUMERIC(18,2) AS net_balance,
--   'Baseline before finance upgrade'
-- FROM public.finance_entries
-- ON CONFLICT (snapshot_tag) DO UPDATE
-- SET
--   total_entries = EXCLUDED.total_entries,
--   total_income = EXCLUDED.total_income,
--   total_expense = EXCLUDED.total_expense,
--   net_balance = EXCLUDED.net_balance,
--   notes = EXCLUDED.notes,
--   captured_at = NOW();

-- =========================================================
-- 3) Compare current values vs one snapshot tag
-- Replace the tag below before running
-- =========================================================

-- WITH current_data AS (
--   SELECT
--     COUNT(*) AS total_entries,
--     COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_income,
--     COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_expense,
--     (
--       COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)
--       -
--       COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)
--     )::NUMERIC(18,2) AS net_balance
--   FROM public.finance_entries
-- ),
-- baseline AS (
--   SELECT *
--   FROM public.finance_migration_snapshots
--   WHERE snapshot_tag = 'pre_upgrade_2026_04_22'
-- )
-- SELECT
--   b.snapshot_tag,
--   b.total_entries AS baseline_entries,
--   c.total_entries AS current_entries,
--   (c.total_entries - b.total_entries) AS diff_entries,
--   b.total_income AS baseline_income,
--   c.total_income AS current_income,
--   (c.total_income - b.total_income)::NUMERIC(18,2) AS diff_income,
--   b.total_expense AS baseline_expense,
--   c.total_expense AS current_expense,
--   (c.total_expense - b.total_expense)::NUMERIC(18,2) AS diff_expense,
--   b.net_balance AS baseline_balance,
--   c.net_balance AS current_balance,
--   (c.net_balance - b.net_balance)::NUMERIC(18,2) AS diff_balance
-- FROM baseline b
-- CROSS JOIN current_data c;

-- =========================================================
-- 4) Data quality checks (read-only diagnostics)
-- =========================================================

-- 4.1 Invalid or missing critical fields
SELECT
  SUM(CASE WHEN description IS NULL OR TRIM(description) = '' THEN 1 ELSE 0 END) AS missing_description,
  SUM(CASE WHEN entry_date IS NULL THEN 1 ELSE 0 END) AS missing_entry_date,
  SUM(CASE WHEN amount IS NULL OR amount <= 0 THEN 1 ELSE 0 END) AS invalid_amount,
  SUM(CASE WHEN entry_type NOT IN ('income', 'expense') THEN 1 ELSE 0 END) AS invalid_entry_type
FROM public.finance_entries;

-- 4.2 Potential duplicated entries (same date + type + amount + description)
SELECT
  entry_date,
  entry_type,
  amount,
  description,
  COUNT(*) AS dup_count
FROM public.finance_entries
GROUP BY entry_date, entry_type, amount, description
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, entry_date DESC
LIMIT 100;

-- 4.3 Category coverage and orphan signals
SELECT
  COUNT(*) FILTER (WHERE category IS NULL OR TRIM(category) = '') AS without_category,
  COUNT(*) FILTER (WHERE subcategory IS NULL OR TRIM(subcategory) = '') AS without_subcategory,
  COUNT(*) FILTER (WHERE payment_method IS NULL OR TRIM(payment_method) = '') AS without_payment_method,
  COUNT(*) FILTER (WHERE counterparty_name IS NULL OR TRIM(counterparty_name) = '') AS without_counterparty
FROM public.finance_entries;

-- =========================================================
-- 5) Phase 2 coverage checks (AP/AR backfill)
-- =========================================================

-- 5.1 How much of legacy ledger was mapped into AP/AR
WITH legacy_entries AS (
  SELECT id, entry_type
  FROM public.finance_entries
  WHERE COALESCE(amount, 0) > 0
)
SELECT
  COUNT(*) FILTER (WHERE entry_type = 'expense') AS legacy_expense_entries,
  COUNT(*) FILTER (
    WHERE entry_type = 'expense'
      AND EXISTS (
        SELECT 1 FROM public.finance_payables fp WHERE fp.source_entry_id = legacy_entries.id
      )
  ) AS mapped_to_payables,
  COUNT(*) FILTER (WHERE entry_type = 'income') AS legacy_income_entries,
  COUNT(*) FILTER (
    WHERE entry_type = 'income'
      AND EXISTS (
        SELECT 1 FROM public.finance_receivables fr WHERE fr.source_entry_id = legacy_entries.id
      )
  ) AS mapped_to_receivables
FROM legacy_entries;

-- 5.2 Any legacy entry still not mapped?
WITH legacy_entries AS (
  SELECT
    id,
    entry_type,
    entry_date,
    description,
    amount,
    category,
    subcategory,
    payment_status
  FROM public.finance_entries
  WHERE COALESCE(amount, 0) > 0
)
SELECT
  le.id,
  le.entry_type,
  le.entry_date,
  le.description,
  le.amount,
  le.category,
  le.subcategory,
  le.payment_status
FROM legacy_entries le
WHERE (
  le.entry_type = 'expense'
  AND NOT EXISTS (SELECT 1 FROM public.finance_payables fp WHERE fp.source_entry_id = le.id)
) OR (
  le.entry_type = 'income'
  AND NOT EXISTS (SELECT 1 FROM public.finance_receivables fr WHERE fr.source_entry_id = le.id)
)
ORDER BY le.entry_date DESC
LIMIT 100;

-- 5.3 AP/AR totals and open balances
SELECT
  COALESCE(SUM(amount), 0)::NUMERIC(18,2) AS payables_total,
  COALESCE(SUM(paid_amount), 0)::NUMERIC(18,2) AS payables_settled,
  COALESCE(SUM(amount - paid_amount), 0)::NUMERIC(18,2) AS payables_open
FROM public.finance_payables;

SELECT
  COALESCE(SUM(amount), 0)::NUMERIC(18,2) AS receivables_total,
  COALESCE(SUM(received_amount), 0)::NUMERIC(18,2) AS receivables_settled,
  COALESCE(SUM(amount - received_amount), 0)::NUMERIC(18,2) AS receivables_open
FROM public.finance_receivables;

-- 5.4 Sanity: status x amount consistency
SELECT
  COUNT(*) FILTER (WHERE status = 'paid' AND paid_amount < amount) AS payables_paid_inconsistent,
  COUNT(*) FILTER (WHERE status = 'open' AND paid_amount > 0) AS payables_open_inconsistent,
  COUNT(*) FILTER (WHERE paid_amount > amount) AS payables_overpaid
FROM public.finance_payables;

SELECT
  COUNT(*) FILTER (WHERE status = 'received' AND received_amount < amount) AS receivables_received_inconsistent,
  COUNT(*) FILTER (WHERE status = 'open' AND received_amount > 0) AS receivables_open_inconsistent,
  COUNT(*) FILTER (WHERE received_amount > amount) AS receivables_overreceived
FROM public.finance_receivables;

-- =========================================================
-- 6) Phase 6 checks (closing, audit and exports)
-- =========================================================

-- 6.1 Closing periods status summary
SELECT
  COUNT(*) AS total_periods,
  COUNT(*) FILTER (WHERE status = 'open') AS open_periods,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_periods,
  COUNT(*) FILTER (WHERE status = 'locked') AS locked_periods
FROM public.finance_closing_periods;

-- 6.2 Audit logs by table (latest activity)
SELECT
  table_name,
  COUNT(*) AS audit_events,
  MAX(changed_at) AS last_change_at
FROM public.finance_audit_logs
GROUP BY table_name
ORDER BY audit_events DESC, table_name;

-- 6.3 Accounting exports summary
SELECT
  COUNT(*) AS total_exports,
  COUNT(*) FILTER (WHERE status = 'generated') AS generated_exports,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_exports,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_exports,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_exports
FROM public.finance_accounting_exports;

-- =========================================================
-- 7) Commissions integrity checks (phase 5 hardening)
-- =========================================================

-- 7.1 Commission totals by status and broker binding quality
SELECT
  COUNT(*) AS total_commissions,
  COUNT(*) FILTER (WHERE status = 'calculated') AS calculated_commissions,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_commissions,
  COUNT(*) FILTER (WHERE status = 'released') AS released_commissions,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_commissions,
  COUNT(*) FILTER (WHERE status = 'contested') AS contested_commissions,
  COUNT(*) FILTER (WHERE status = 'reversed') AS reversed_commissions,
  COUNT(*) FILTER (
    WHERE (broker_user_id IS NULL OR TRIM(broker_user_id::TEXT) = '')
      AND (broker_name IS NULL OR TRIM(broker_name) = '')
  ) AS without_broker_binding
FROM public.finance_commissions;

-- 7.2 Status/payment consistency for commissions
SELECT
  COUNT(*) FILTER (WHERE status = 'paid' AND payment_entry_id IS NULL) AS paid_without_payment_entry,
  COUNT(*) FILTER (WHERE status = 'paid' AND paid_at IS NULL) AS paid_without_paid_at,
  COUNT(*) FILTER (WHERE status IN ('approved', 'released') AND paid_at IS NOT NULL) AS approved_or_released_with_paid_at,
  COUNT(*) FILTER (WHERE commission_amount < 0) AS negative_commission_amount
FROM public.finance_commissions;

-- 7.3 Sale reference integrity (expects source_ref_id = lead UUID and lead closed/converted)
WITH sale_commissions AS (
  SELECT
    fc.id,
    fc.source_ref_type,
    fc.source_ref_id,
    CASE
      WHEN fc.source_ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN fc.source_ref_id::UUID
      ELSE NULL
    END AS source_lead_uuid
  FROM public.finance_commissions fc
  WHERE LOWER(COALESCE(TRIM(fc.source_ref_type), '')) IN ('sale', 'venda', 'deal', 'negocio', 'contract', 'contrato')
)
SELECT
  COUNT(*) AS sale_commissions_total,
  COUNT(*) FILTER (WHERE source_ref_id IS NULL OR TRIM(source_ref_id) = '') AS sale_without_source_ref_id,
  COUNT(*) FILTER (
    WHERE source_ref_id IS NOT NULL
      AND TRIM(source_ref_id) <> ''
      AND source_lead_uuid IS NULL
  ) AS sale_with_non_uuid_reference,
  COUNT(*) FILTER (
    WHERE source_lead_uuid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = sale_commissions.source_lead_uuid
      )
  ) AS sale_with_missing_lead,
  COUNT(*) FILTER (
    WHERE source_lead_uuid IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = sale_commissions.source_lead_uuid
          AND LOWER(COALESCE(TRIM(l.funnel_stage), '')) NOT IN ('closed', 'converted')
      )
  ) AS sale_with_lead_not_closed
FROM sale_commissions;

-- 7.4 Detailed list of problematic sale-linked commissions (top 100)
WITH sale_commissions AS (
  SELECT
    fc.id,
    fc.created_at,
    fc.status,
    fc.source_ref_type,
    fc.source_ref_id,
    fc.broker_user_id,
    fc.broker_name,
    fc.commission_amount,
    CASE
      WHEN fc.source_ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN fc.source_ref_id::UUID
      ELSE NULL
    END AS source_lead_uuid
  FROM public.finance_commissions fc
  WHERE LOWER(COALESCE(TRIM(fc.source_ref_type), '')) IN ('sale', 'venda', 'deal', 'negocio', 'contract', 'contrato')
)
SELECT
  sc.id,
  sc.created_at,
  sc.status,
  sc.source_ref_type,
  sc.source_ref_id,
  sc.broker_user_id,
  sc.broker_name,
  sc.commission_amount,
  l.funnel_stage AS lead_funnel_stage,
  CASE
    WHEN sc.source_ref_id IS NULL OR TRIM(sc.source_ref_id) = '' THEN 'missing_source_ref_id'
    WHEN sc.source_lead_uuid IS NULL THEN 'invalid_source_ref_id_not_uuid'
    WHEN l.id IS NULL THEN 'lead_not_found'
    WHEN LOWER(COALESCE(TRIM(l.funnel_stage), '')) NOT IN ('closed', 'converted') THEN 'lead_not_closed_or_converted'
    ELSE 'ok'
  END AS issue_type
FROM sale_commissions sc
LEFT JOIN public.leads l
  ON l.id = sc.source_lead_uuid
WHERE
  sc.source_ref_id IS NULL
  OR TRIM(sc.source_ref_id) = ''
  OR sc.source_lead_uuid IS NULL
  OR l.id IS NULL
  OR LOWER(COALESCE(TRIM(l.funnel_stage), '')) NOT IN ('closed', 'converted')
ORDER BY sc.created_at DESC
LIMIT 100;

-- =========================================================
-- 8) Final go-live validation (snapshot + pre/post diff)
-- =========================================================

-- 8.1 Save post-upgrade snapshot (update tag/date if needed)
INSERT INTO public.finance_migration_snapshots (
  snapshot_tag,
  total_entries,
  total_income,
  total_expense,
  net_balance,
  notes
)
SELECT
  'post_upgrade_2026_04_22',
  COUNT(*) AS total_entries,
  COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_income,
  COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_expense,
  (
    COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE 0 END), 0)
    -
    COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0)
  )::NUMERIC(18,2) AS net_balance,
  'Snapshot after full finance upgrade'
FROM public.finance_entries
ON CONFLICT (snapshot_tag) DO UPDATE
SET
  total_entries = EXCLUDED.total_entries,
  total_income = EXCLUDED.total_income,
  total_expense = EXCLUDED.total_expense,
  net_balance = EXCLUDED.net_balance,
  notes = EXCLUDED.notes,
  captured_at = NOW();

-- 8.2 Compare pre vs post snapshot tags
WITH pre AS (
  SELECT *
  FROM public.finance_migration_snapshots
  WHERE snapshot_tag = 'pre_upgrade_2026_04_22'
),
post AS (
  SELECT *
  FROM public.finance_migration_snapshots
  WHERE snapshot_tag = 'post_upgrade_2026_04_22'
),
flags AS (
  SELECT
    EXISTS (SELECT 1 FROM pre) AS has_pre,
    EXISTS (SELECT 1 FROM post) AS has_post
),
joined AS (
  SELECT
    pre.snapshot_tag AS pre_tag,
    post.snapshot_tag AS post_tag,
    pre.total_entries AS pre_entries,
    post.total_entries AS post_entries,
    (post.total_entries - pre.total_entries) AS diff_entries,
    pre.total_income AS pre_income,
    post.total_income AS post_income,
    (post.total_income - pre.total_income)::NUMERIC(18,2) AS diff_income,
    pre.total_expense AS pre_expense,
    post.total_expense AS post_expense,
    (post.total_expense - pre.total_expense)::NUMERIC(18,2) AS diff_expense,
    pre.net_balance AS pre_balance,
    post.net_balance AS post_balance,
    (post.net_balance - pre.net_balance)::NUMERIC(18,2) AS diff_balance
  FROM pre
  CROSS JOIN post
)
SELECT
  CASE
    WHEN NOT flags.has_post THEN 'MISSING_POST'
    WHEN NOT flags.has_pre THEN 'MISSING_PRE'
    ELSE 'READY'
  END AS comparison_status,
  joined.pre_tag,
  joined.post_tag,
  joined.pre_entries,
  joined.post_entries,
  joined.diff_entries,
  joined.pre_income,
  joined.post_income,
  joined.diff_income,
  joined.pre_expense,
  joined.post_expense,
  joined.diff_expense,
  joined.pre_balance,
  joined.post_balance,
  joined.diff_balance
FROM flags
LEFT JOIN joined ON TRUE;

-- 8.3 Final approval gate (GO when no baseline divergence)
WITH pre AS (
  SELECT *
  FROM public.finance_migration_snapshots
  WHERE snapshot_tag = 'pre_upgrade_2026_04_22'
),
post AS (
  SELECT *
  FROM public.finance_migration_snapshots
  WHERE snapshot_tag = 'post_upgrade_2026_04_22'
),
flags AS (
  SELECT
    EXISTS (SELECT 1 FROM pre) AS has_pre,
    EXISTS (SELECT 1 FROM post) AS has_post
),
diffs AS (
  SELECT
    (post.total_entries - pre.total_entries) AS diff_entries,
    (post.total_income - pre.total_income)::NUMERIC(18,2) AS diff_income,
    (post.total_expense - pre.total_expense)::NUMERIC(18,2) AS diff_expense,
    (post.net_balance - pre.net_balance)::NUMERIC(18,2) AS diff_balance
  FROM pre
  CROSS JOIN post
)
SELECT
  CASE
    WHEN NOT flags.has_post THEN 'MISSING_POST'
    WHEN NOT flags.has_pre THEN 'INSUFFICIENT_BASELINE'
    WHEN diffs.diff_entries = 0
      AND diff_income = 0
      AND diff_expense = 0
      AND diff_balance = 0
    THEN 'GO'
    ELSE 'REVIEW'
  END AS upgrade_status,
  diffs.diff_entries,
  diffs.diff_income,
  diffs.diff_expense,
  diffs.diff_balance
FROM flags
LEFT JOIN diffs ON TRUE;
