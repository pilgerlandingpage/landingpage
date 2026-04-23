-- Finance upgrade foundation for real-estate operation
-- Non-destructive migration: only CREATE/ALTER with backwards compatibility.

BEGIN;

-- =========================================================
-- Core catalogs for upgraded financial operation
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  bank_name TEXT,
  branch TEXT,
  account_number TEXT,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- AP / AR operation
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date DATE NOT NULL,
  competence_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  category TEXT,
  subcategory TEXT,
  counterparty_name TEXT,
  counterparty_type TEXT CHECK (counterparty_type IN ('pessoa_fisica', 'pessoa_juridica')),
  payment_method TEXT,
  cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (paid_amount <= amount)
);

CREATE TABLE IF NOT EXISTS public.finance_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  source_ref_type TEXT,
  source_ref_id TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  received_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  due_date DATE NOT NULL,
  competence_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_received', 'received', 'overdue', 'cancelled')),
  category TEXT,
  subcategory TEXT,
  counterparty_name TEXT,
  counterparty_type TEXT CHECK (counterparty_type IN ('pessoa_fisica', 'pessoa_juridica')),
  payment_method TEXT,
  cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (received_amount <= amount)
);

-- =========================================================
-- Commission engine
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to TEXT,
  basis_type TEXT NOT NULL DEFAULT 'sale_value' CHECK (basis_type IN ('sale_value', 'net_revenue')),
  calc_type TEXT NOT NULL DEFAULT 'percentage' CHECK (calc_type IN ('percentage', 'fixed')),
  percentage NUMERIC(8,5),
  fixed_amount NUMERIC(14,2),
  min_sale_amount NUMERIC(14,2),
  max_sale_amount NUMERIC(14,2),
  split_payload JSONB,
  starts_at DATE,
  ends_at DATE,
  notes TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (calc_type = 'percentage' AND percentage IS NOT NULL AND fixed_amount IS NULL)
    OR
    (calc_type = 'fixed' AND fixed_amount IS NOT NULL AND percentage IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.finance_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.finance_commission_rules(id) ON DELETE SET NULL,
  source_ref_type TEXT,
  source_ref_id TEXT,
  broker_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  broker_name TEXT,
  sale_amount NUMERIC(14,2),
  commission_base NUMERIC(14,2),
  commission_amount NUMERIC(14,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'approved', 'released', 'paid', 'contested', 'reversed')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- Reconciliation and closing
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  statement_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL,
  external_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'ignored')),
  matched_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  matched_payable_id UUID REFERENCES public.finance_payables(id) ON DELETE SET NULL,
  matched_receivable_id UUID REFERENCES public.finance_receivables(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_closing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  closed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_accounting_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'confirmed', 'failed')),
  file_url TEXT,
  payload JSONB,
  generated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baseline snapshots to validate data integrity through migrations.
CREATE TABLE IF NOT EXISTS public.finance_migration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_tag TEXT NOT NULL UNIQUE,
  total_entries BIGINT NOT NULL,
  total_income NUMERIC(18,2) NOT NULL,
  total_expense NUMERIC(18,2) NOT NULL,
  net_balance NUMERIC(18,2) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Ensure required columns exist in case tables were created partially in previous attempts.
DO $$
BEGIN
  IF to_regclass('public.finance_payables') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_payables
        ADD COLUMN IF NOT EXISTS source_entry_id UUID,
        ADD COLUMN IF NOT EXISTS due_date DATE,
        ADD COLUMN IF NOT EXISTS competence_date DATE,
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS cost_center_id UUID,
        ADD COLUMN IF NOT EXISTS bank_account_id UUID,
        ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0
    ';
  END IF;

  IF to_regclass('public.finance_receivables') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_receivables
        ADD COLUMN IF NOT EXISTS source_entry_id UUID,
        ADD COLUMN IF NOT EXISTS source_ref_type TEXT,
        ADD COLUMN IF NOT EXISTS source_ref_id TEXT,
        ADD COLUMN IF NOT EXISTS due_date DATE,
        ADD COLUMN IF NOT EXISTS competence_date DATE,
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS cost_center_id UUID,
        ADD COLUMN IF NOT EXISTS bank_account_id UUID,
        ADD COLUMN IF NOT EXISTS received_amount NUMERIC(14,2) NOT NULL DEFAULT 0
    ';
  END IF;

  IF to_regclass('public.finance_commissions') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_commissions
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS broker_user_id UUID,
        ADD COLUMN IF NOT EXISTS due_date DATE
    ';
  END IF;

  IF to_regclass('public.finance_reconciliations') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_reconciliations
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS statement_date DATE
    ';
  END IF;
END $$;

-- =========================================================
-- Backwards-compatible extensions on current ledger
-- =========================================================

DO $$
BEGIN
  IF to_regclass('public.finance_entries') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_entries
        ADD COLUMN IF NOT EXISTS due_date DATE,
        ADD COLUMN IF NOT EXISTS competence_date DATE,
        ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source_module TEXT,
        ADD COLUMN IF NOT EXISTS external_reference TEXT,
        ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ
    ';
  END IF;
END $$;

-- Safe backfill for new date fields based on legacy date columns.
DO $$
BEGIN
  IF to_regclass('public.finance_entries') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'due_date'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'entry_date'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET due_date = COALESCE(due_date, entry_date)
        WHERE due_date IS NULL
          AND entry_date IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'date'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET due_date = COALESCE(due_date, date)
        WHERE due_date IS NULL
          AND date IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'occurred_at'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET due_date = COALESCE(due_date, occurred_at::date)
        WHERE due_date IS NULL
          AND occurred_at IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'created_at'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET due_date = COALESCE(due_date, created_at::date)
        WHERE due_date IS NULL
          AND created_at IS NOT NULL
      ';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'competence_date'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'entry_date'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET competence_date = COALESCE(competence_date, entry_date)
        WHERE competence_date IS NULL
          AND entry_date IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'date'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET competence_date = COALESCE(competence_date, date)
        WHERE competence_date IS NULL
          AND date IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'occurred_at'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET competence_date = COALESCE(competence_date, occurred_at::date)
        WHERE competence_date IS NULL
          AND occurred_at IS NOT NULL
      ';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'created_at'
    ) THEN
      EXECUTE '
        UPDATE public.finance_entries
        SET competence_date = COALESCE(competence_date, created_at::date)
        WHERE competence_date IS NULL
          AND created_at IS NOT NULL
      ';
    END IF;
  END IF;
END $$;

-- =========================================================
-- Indexes
-- =========================================================

DO $$
BEGIN
  IF to_regclass('public.finance_payables') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_payables' AND column_name = 'due_date'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_payables_due_date ON public.finance_payables(due_date)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_payables' AND column_name = 'status'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_payables_status ON public.finance_payables(status)';
    END IF;
  END IF;

  IF to_regclass('public.finance_receivables') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_receivables' AND column_name = 'due_date'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_receivables_due_date ON public.finance_receivables(due_date)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_receivables' AND column_name = 'status'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_receivables_status ON public.finance_receivables(status)';
    END IF;
  END IF;

  IF to_regclass('public.finance_commissions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_commissions' AND column_name = 'status'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_commissions_status ON public.finance_commissions(status)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_commissions' AND column_name = 'broker_user_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_commissions_broker_user_id ON public.finance_commissions(broker_user_id)';
    END IF;
  END IF;

  IF to_regclass('public.finance_reconciliations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_reconciliations' AND column_name = 'status'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_status ON public.finance_reconciliations(status)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_reconciliations' AND column_name = 'statement_date'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_statement_date ON public.finance_reconciliations(statement_date DESC)';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_entries') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'due_date'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_entries_due_date ON public.finance_entries(due_date DESC)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'cost_center_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_entries_cost_center ON public.finance_entries(cost_center_id)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'bank_account_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_entries_bank_account ON public.finance_entries(bank_account_id)';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_entries' AND column_name = 'is_reconciled'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_finance_entries_is_reconciled ON public.finance_entries(is_reconciled)';
    END IF;
  END IF;
END $$;

-- =========================================================
-- Security policy: keep same service role strategy used in current project
-- =========================================================

ALTER TABLE public.finance_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_closing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_migration_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_cost_centers'
      AND policyname = 'service_role_full_access_finance_cost_centers'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_cost_centers"
      ON public.finance_cost_centers FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_bank_accounts'
      AND policyname = 'service_role_full_access_finance_bank_accounts'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_bank_accounts"
      ON public.finance_bank_accounts FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_payables'
      AND policyname = 'service_role_full_access_finance_payables'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_payables"
      ON public.finance_payables FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_receivables'
      AND policyname = 'service_role_full_access_finance_receivables'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_receivables"
      ON public.finance_receivables FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_commission_rules'
      AND policyname = 'service_role_full_access_finance_commission_rules'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_commission_rules"
      ON public.finance_commission_rules FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_commissions'
      AND policyname = 'service_role_full_access_finance_commissions'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_commissions"
      ON public.finance_commissions FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_reconciliations'
      AND policyname = 'service_role_full_access_finance_reconciliations'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_reconciliations"
      ON public.finance_reconciliations FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_closing_periods'
      AND policyname = 'service_role_full_access_finance_closing_periods'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_closing_periods"
      ON public.finance_closing_periods FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_accounting_exports'
      AND policyname = 'service_role_full_access_finance_accounting_exports'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_accounting_exports"
      ON public.finance_accounting_exports FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_migration_snapshots'
      AND policyname = 'service_role_full_access_finance_migration_snapshots'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_migration_snapshots"
      ON public.finance_migration_snapshots FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- Seed minimal starter catalogs (idempotent)
-- =========================================================

INSERT INTO public.finance_cost_centers (name, code)
VALUES
  ('Comercial', 'COM'),
  ('Marketing', 'MKT'),
  ('Operacao', 'OPE'),
  ('Diretoria', 'DIR')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.finance_bank_accounts (name, bank_name)
VALUES
  ('Conta Principal', 'A definir'),
  ('Conta Operacional', 'A definir')
ON CONFLICT (name) DO NOTHING;

COMMIT;
