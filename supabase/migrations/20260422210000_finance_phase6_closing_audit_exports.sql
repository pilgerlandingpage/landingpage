-- Finance phase 6: monthly closing, audit trail and accounting export base
-- Non-destructive and idempotent.

BEGIN;

-- =========================================================
-- Audit trail for critical finance entities
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_data JSONB,
  after_data JSONB,
  source_module TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_table_changed_at
  ON public.finance_audit_logs(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_record_id
  ON public.finance_audit_logs(record_id);

ALTER TABLE public.finance_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_audit_logs'
      AND policyname = 'service_role_full_access_finance_audit_logs'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_audit_logs"
      ON public.finance_audit_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finance_try_uuid(p_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v UUID;
BEGIN
  IF p_value IS NULL OR BTRIM(p_value) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v := p_value::UUID;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_capture_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload_before JSONB;
  payload_after JSONB;
  payload_actor TEXT;
  payload_record_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload_before := NULL;
    payload_after := to_jsonb(NEW);
    payload_actor := payload_after->>'created_by';
    payload_record_id := COALESCE(payload_after->>'id', NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    payload_before := to_jsonb(OLD);
    payload_after := to_jsonb(NEW);
    payload_actor := COALESCE(payload_after->>'created_by', payload_before->>'created_by');
    payload_record_id := COALESCE(payload_after->>'id', payload_before->>'id');

    IF payload_before IS NOT DISTINCT FROM payload_after THEN
      RETURN NEW;
    END IF;
  ELSE
    payload_before := to_jsonb(OLD);
    payload_after := NULL;
    payload_actor := payload_before->>'created_by';
    payload_record_id := payload_before->>'id';
  END IF;

  INSERT INTO public.finance_audit_logs (
    table_name,
    record_id,
    action,
    changed_by,
    changed_at,
    before_data,
    after_data,
    source_module
  ) VALUES (
    TG_TABLE_NAME,
    payload_record_id,
    TG_OP,
    public.finance_try_uuid(payload_actor),
    NOW(),
    payload_before,
    payload_after,
    TG_TABLE_NAME
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table TEXT;
  target_tables TEXT[] := ARRAY[
    'finance_entries',
    'finance_payables',
    'finance_receivables',
    'finance_commissions',
    'finance_reconciliations',
    'finance_closing_periods',
    'finance_accounting_exports'
  ];
BEGIN
  FOREACH target_table IN ARRAY target_tables
  LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', target_table, target_table);
      EXECUTE format(
        'CREATE TRIGGER trg_%I_audit
           AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log()',
        target_table,
        target_table
      );
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- Monthly closing helpers
-- =========================================================

CREATE OR REPLACE FUNCTION public.finance_close_period(
  p_period_month DATE,
  p_actor UUID DEFAULT NULL,
  p_lock BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  period_month DATE,
  status TEXT,
  closed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  totals JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_period DATE;
  v_existing_status TEXT;
  v_income NUMERIC(18,2);
  v_expense NUMERIC(18,2);
  v_entries BIGINT;
BEGIN
  IF p_period_month IS NULL THEN
    RAISE EXCEPTION 'periodo invalido';
  END IF;

  normalized_period := date_trunc('month', p_period_month)::DATE;

  SELECT fcp.status
  INTO v_existing_status
  FROM public.finance_closing_periods fcp
  WHERE fcp.period_month = normalized_period;

  IF v_existing_status = 'locked' AND NOT p_lock THEN
    RAISE EXCEPTION 'periodo % esta bloqueado e nao pode ser apenas fechado', normalized_period;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN fe.entry_type = 'income' THEN fe.amount ELSE 0 END), 0)::NUMERIC(18,2),
    COALESCE(SUM(CASE WHEN fe.entry_type = 'expense' THEN fe.amount ELSE 0 END), 0)::NUMERIC(18,2)
  INTO v_entries, v_income, v_expense
  FROM public.finance_entries fe
  WHERE date_trunc('month', COALESCE(fe.competence_date, fe.due_date, fe.entry_date))::DATE = normalized_period;

  INSERT INTO public.finance_closing_periods (
    period_month,
    status,
    closed_at,
    locked_at,
    closed_by,
    notes,
    updated_at
  ) VALUES (
    normalized_period,
    CASE WHEN p_lock THEN 'locked' ELSE 'closed' END,
    NOW(),
    CASE WHEN p_lock THEN NOW() ELSE NULL END,
    p_actor,
    p_notes,
    NOW()
  )
  ON CONFLICT (period_month) DO UPDATE
  SET
    status = CASE WHEN p_lock THEN 'locked' ELSE 'closed' END,
    closed_at = COALESCE(public.finance_closing_periods.closed_at, NOW()),
    locked_at = CASE
      WHEN p_lock THEN COALESCE(public.finance_closing_periods.locked_at, NOW())
      ELSE public.finance_closing_periods.locked_at
    END,
    closed_by = COALESCE(EXCLUDED.closed_by, public.finance_closing_periods.closed_by),
    notes = COALESCE(EXCLUDED.notes, public.finance_closing_periods.notes),
    updated_at = NOW();

  RETURN QUERY
  SELECT
    fcp.period_month,
    fcp.status,
    fcp.closed_at,
    fcp.locked_at,
    jsonb_build_object(
      'entries', v_entries,
      'income', v_income,
      'expense', v_expense,
      'net', (v_income - v_expense)::NUMERIC(18,2)
    ) AS totals
  FROM public.finance_closing_periods fcp
  WHERE fcp.period_month = normalized_period;
END;
$$;

-- =========================================================
-- Accounting export base (view)
-- =========================================================

CREATE OR REPLACE VIEW public.finance_accounting_export_lines AS
SELECT
  fe.id AS entry_id,
  COALESCE(fe.competence_date, fe.due_date, fe.entry_date) AS accounting_date,
  fe.entry_type,
  fe.amount::NUMERIC(18,2) AS amount,
  CASE
    WHEN fe.entry_type = 'income' THEN fe.amount::NUMERIC(18,2)
    ELSE (fe.amount * -1)::NUMERIC(18,2)
  END AS signed_amount,
  fe.description,
  fe.category,
  fe.subcategory,
  fe.payment_method,
  fe.payment_status,
  fe.counterparty_name,
  fe.counterparty_type,
  fe.reference_company,
  fe.cost_center_id,
  fe.bank_account_id,
  fe.source_module,
  fe.external_reference,
  fe.notes,
  fe.created_at
FROM public.finance_entries fe;

COMMIT;
