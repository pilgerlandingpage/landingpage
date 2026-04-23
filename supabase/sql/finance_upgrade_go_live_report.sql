-- Finance upgrade go-live report (single-shot executive validation)
-- Purpose: summarize integrity checks and output a single go_live_status.
-- Note: this script is read-only.

WITH params AS (
  SELECT
    'pre_upgrade_2026_04_23'::TEXT AS pre_tag,
    'post_upgrade_2026_04_23'::TEXT AS post_tag
),
snapshot_flags AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM public.finance_migration_snapshots
      WHERE snapshot_tag = (SELECT pre_tag FROM params)
    ) AS has_pre,
    EXISTS (
      SELECT 1
      FROM public.finance_migration_snapshots
      WHERE snapshot_tag = (SELECT post_tag FROM params)
    ) AS has_post
),
snapshot_diffs AS (
  SELECT
    (post.total_entries - pre.total_entries) AS diff_entries,
    (post.total_income - pre.total_income)::NUMERIC(18,2) AS diff_income,
    (post.total_expense - pre.total_expense)::NUMERIC(18,2) AS diff_expense,
    (post.net_balance - pre.net_balance)::NUMERIC(18,2) AS diff_balance
  FROM public.finance_migration_snapshots pre
  JOIN public.finance_migration_snapshots post
    ON pre.snapshot_tag = (SELECT pre_tag FROM params)
   AND post.snapshot_tag = (SELECT post_tag FROM params)
),
data_quality AS (
  SELECT
    SUM(CASE WHEN description IS NULL OR TRIM(description) = '' THEN 1 ELSE 0 END) AS missing_description,
    SUM(CASE WHEN entry_date IS NULL THEN 1 ELSE 0 END) AS missing_entry_date,
    SUM(CASE WHEN amount IS NULL OR amount <= 0 THEN 1 ELSE 0 END) AS invalid_amount,
    SUM(CASE WHEN entry_type NOT IN ('income', 'expense') THEN 1 ELSE 0 END) AS invalid_entry_type
  FROM public.finance_entries
),
apar_quality AS (
  SELECT
    (SELECT COUNT(*) FROM public.finance_payables p WHERE p.status = 'paid' AND p.paid_amount < p.amount) AS payables_paid_inconsistent,
    (SELECT COUNT(*) FROM public.finance_payables p WHERE p.status = 'open' AND p.paid_amount > 0) AS payables_open_inconsistent,
    (SELECT COUNT(*) FROM public.finance_payables p WHERE p.paid_amount > p.amount) AS payables_overpaid,
    (SELECT COUNT(*) FROM public.finance_receivables r WHERE r.status = 'received' AND r.received_amount < r.amount) AS receivables_received_inconsistent,
    (SELECT COUNT(*) FROM public.finance_receivables r WHERE r.status = 'open' AND r.received_amount > 0) AS receivables_open_inconsistent,
    (SELECT COUNT(*) FROM public.finance_receivables r WHERE r.received_amount > r.amount) AS receivables_overreceived
),
commission_quality AS (
  SELECT
    (SELECT COUNT(*) FROM public.finance_commissions c WHERE c.status = 'paid' AND c.payment_entry_id IS NULL) AS paid_without_payment_entry,
    (SELECT COUNT(*) FROM public.finance_commissions c WHERE c.status = 'paid' AND c.paid_at IS NULL) AS paid_without_paid_at,
    (SELECT COUNT(*) FROM public.finance_commissions c WHERE c.status IN ('approved', 'released') AND c.paid_at IS NOT NULL) AS approved_or_released_with_paid_at,
    (SELECT COUNT(*) FROM public.finance_commissions c WHERE c.commission_amount < 0) AS negative_commission_amount
),
sale_reference_quality AS (
  WITH sale_commissions AS (
    SELECT
      fc.id,
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
    COUNT(*) FILTER (WHERE source_ref_id IS NULL OR TRIM(source_ref_id) = '') AS sale_without_source_ref_id,
    COUNT(*) FILTER (
      WHERE source_ref_id IS NOT NULL
        AND TRIM(source_ref_id) <> ''
        AND source_lead_uuid IS NULL
    ) AS sale_with_non_uuid_reference,
    COUNT(*) FILTER (
      WHERE source_lead_uuid IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = sale_commissions.source_lead_uuid)
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
  FROM sale_commissions
),
gates AS (
  SELECT
    sf.has_pre,
    sf.has_post,
    sd.diff_entries,
    sd.diff_income,
    sd.diff_expense,
    sd.diff_balance,
    dq.missing_description,
    dq.missing_entry_date,
    dq.invalid_amount,
    dq.invalid_entry_type,
    ap.payables_paid_inconsistent,
    ap.payables_open_inconsistent,
    ap.payables_overpaid,
    ap.receivables_received_inconsistent,
    ap.receivables_open_inconsistent,
    ap.receivables_overreceived,
    cq.paid_without_payment_entry,
    cq.paid_without_paid_at,
    cq.approved_or_released_with_paid_at,
    cq.negative_commission_amount,
    sr.sale_without_source_ref_id,
    sr.sale_with_non_uuid_reference,
    sr.sale_with_missing_lead,
    sr.sale_with_lead_not_closed
  FROM snapshot_flags sf
  LEFT JOIN snapshot_diffs sd ON TRUE
  CROSS JOIN data_quality dq
  CROSS JOIN apar_quality ap
  CROSS JOIN commission_quality cq
  CROSS JOIN sale_reference_quality sr
)
SELECT
  CASE
    WHEN NOT has_post THEN 'BLOCKED_MISSING_POST'
    WHEN has_pre AND (
      COALESCE(diff_entries, 0) <> 0
      OR COALESCE(diff_income, 0) <> 0
      OR COALESCE(diff_expense, 0) <> 0
      OR COALESCE(diff_balance, 0) <> 0
    ) THEN 'REVIEW_BASELINE_DIVERGENCE'
    WHEN
      COALESCE(missing_description, 0) > 0
      OR COALESCE(missing_entry_date, 0) > 0
      OR COALESCE(invalid_amount, 0) > 0
      OR COALESCE(invalid_entry_type, 0) > 0
      OR COALESCE(payables_paid_inconsistent, 0) > 0
      OR COALESCE(payables_open_inconsistent, 0) > 0
      OR COALESCE(payables_overpaid, 0) > 0
      OR COALESCE(receivables_received_inconsistent, 0) > 0
      OR COALESCE(receivables_open_inconsistent, 0) > 0
      OR COALESCE(receivables_overreceived, 0) > 0
      OR COALESCE(paid_without_payment_entry, 0) > 0
      OR COALESCE(paid_without_paid_at, 0) > 0
      OR COALESCE(approved_or_released_with_paid_at, 0) > 0
      OR COALESCE(negative_commission_amount, 0) > 0
      OR COALESCE(sale_without_source_ref_id, 0) > 0
      OR COALESCE(sale_with_non_uuid_reference, 0) > 0
      OR COALESCE(sale_with_missing_lead, 0) > 0
      OR COALESCE(sale_with_lead_not_closed, 0) > 0
    THEN 'REVIEW_INTEGRITY_ISSUES'
    WHEN NOT has_pre THEN 'GO_LIMITED_BASELINE'
    ELSE 'GO'
  END AS go_live_status,
  has_pre,
  has_post,
  diff_entries,
  diff_income,
  diff_expense,
  diff_balance,
  missing_description,
  missing_entry_date,
  invalid_amount,
  invalid_entry_type,
  payables_paid_inconsistent,
  payables_open_inconsistent,
  payables_overpaid,
  receivables_received_inconsistent,
  receivables_open_inconsistent,
  receivables_overreceived,
  paid_without_payment_entry,
  paid_without_paid_at,
  approved_or_released_with_paid_at,
  negative_commission_amount,
  sale_without_source_ref_id,
  sale_with_non_uuid_reference,
  sale_with_missing_lead,
  sale_with_lead_not_closed
FROM gates;
