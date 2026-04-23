-- Finance upgrade phase 2: backfill + normalization (idempotent)
-- Preserves legacy ledger data and populates AP/AR complements.

BEGIN;

-- =========================================================
-- Ensure legacy ledger has expected compatibility fields
-- =========================================================

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS reference_company TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS competence_date DATE,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- =========================================================
-- Ensure AP/AR tables have required columns (partial schema safe)
-- =========================================================

DO $$
BEGIN
  IF to_regclass('public.finance_payables') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_payables
        ADD COLUMN IF NOT EXISTS source_entry_id UUID,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS due_date DATE,
        ADD COLUMN IF NOT EXISTS competence_date DATE,
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS subcategory TEXT,
        ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
        ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
        ADD COLUMN IF NOT EXISTS payment_method TEXT,
        ADD COLUMN IF NOT EXISTS cost_center_id UUID,
        ADD COLUMN IF NOT EXISTS bank_account_id UUID,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_by UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ';
  END IF;

  IF to_regclass('public.finance_receivables') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.finance_receivables
        ADD COLUMN IF NOT EXISTS source_entry_id UUID,
        ADD COLUMN IF NOT EXISTS source_ref_type TEXT,
        ADD COLUMN IF NOT EXISTS source_ref_id TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS received_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS due_date DATE,
        ADD COLUMN IF NOT EXISTS competence_date DATE,
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS subcategory TEXT,
        ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
        ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
        ADD COLUMN IF NOT EXISTS payment_method TEXT,
        ADD COLUMN IF NOT EXISTS cost_center_id UUID,
        ADD COLUMN IF NOT EXISTS bank_account_id UUID,
        ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_by UUID,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ';
  END IF;
END $$;

-- =========================================================
-- Normalize legacy fields imported from spreadsheet/history
-- =========================================================

UPDATE public.finance_entries
SET category = NULLIF(REGEXP_REPLACE(BTRIM(category), '\s+', ' ', 'g'), '')
WHERE category IS NOT NULL;

UPDATE public.finance_entries
SET subcategory = NULLIF(REGEXP_REPLACE(BTRIM(subcategory), '\s+', ' ', 'g'), '')
WHERE subcategory IS NOT NULL;

UPDATE public.finance_entries
SET payment_method = NULLIF(REGEXP_REPLACE(BTRIM(payment_method), '\s+', ' ', 'g'), '')
WHERE payment_method IS NOT NULL;

UPDATE public.finance_entries
SET counterparty_name = NULLIF(REGEXP_REPLACE(BTRIM(counterparty_name), '\s+', ' ', 'g'), '')
WHERE counterparty_name IS NOT NULL;

UPDATE public.finance_entries
SET category = CASE
  WHEN category IN ('System.Xml.XmlElement') THEN 'Estrutura'
  WHEN category IN ('Life Style', 'life style') THEN 'Lifestyle'
  WHEN category IN ('JurÃ­dico', 'Jurídico') THEN 'Juridico'
  WHEN category IN ('ManutenÃ§Ã£o despesas', 'Manutenção despesas') THEN 'Manutencao despesas'
  ELSE category
END
WHERE category IS NOT NULL;

UPDATE public.finance_entries
SET payment_status = CASE
  WHEN payment_status IS NULL OR BTRIM(payment_status) = '' THEN 'paid'
  WHEN LOWER(BTRIM(payment_status)) IN ('pago', 'paid', 'quitado', 'liquidado', 'recebido', 'recebida', 'efetivado', 'efetivada') THEN 'paid'
  WHEN LOWER(BTRIM(payment_status)) IN ('pendente', 'pending', 'aberto', 'open', 'vencido', 'vencida', 'a vencer', 'aguardando') THEN 'pending'
  WHEN LOWER(BTRIM(payment_status)) IN ('cancelado', 'cancelada', 'cancelled', 'canceled', 'estornado', 'estornada') THEN 'cancelled'
  ELSE 'pending'
END
WHERE payment_status IS NULL
   OR BTRIM(payment_status) = ''
   OR LOWER(BTRIM(payment_status)) NOT IN ('paid', 'pending', 'cancelled');

UPDATE public.finance_entries
SET counterparty_type = CASE
  WHEN counterparty_type IS NULL OR BTRIM(counterparty_type) = '' THEN 'pessoa_juridica'
  WHEN LOWER(BTRIM(counterparty_type)) IN ('pf', 'pessoa fisica', 'pessoa_fisica', 'fisica', 'física') THEN 'pessoa_fisica'
  WHEN LOWER(BTRIM(counterparty_type)) IN ('pj', 'pessoa juridica', 'pessoa_juridica', 'juridica', 'jurídica') THEN 'pessoa_juridica'
  ELSE 'pessoa_juridica'
END
WHERE counterparty_type IS NULL
   OR BTRIM(counterparty_type) = ''
   OR LOWER(BTRIM(counterparty_type)) NOT IN ('pessoa_fisica', 'pessoa_juridica');

UPDATE public.finance_entries
SET due_date = COALESCE(due_date, entry_date, created_at::date, CURRENT_DATE)
WHERE due_date IS NULL;

UPDATE public.finance_entries
SET competence_date = COALESCE(competence_date, due_date, entry_date, created_at::date, CURRENT_DATE)
WHERE competence_date IS NULL;

-- =========================================================
-- Backfill finance_payables / finance_receivables from legacy ledger
-- =========================================================

WITH legacy_entries AS (
  SELECT
    fe.id,
    fe.entry_type,
    COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
    ABS(fe.amount)::NUMERIC(14,2) AS amount,
    COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS due_date,
    COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS competence_date,
    COALESCE(NULLIF(BTRIM(fe.payment_status), ''), 'paid') AS payment_status,
    NULLIF(BTRIM(fe.category), '') AS category,
    NULLIF(BTRIM(fe.subcategory), '') AS subcategory,
    NULLIF(BTRIM(fe.counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica') AS counterparty_type,
    NULLIF(BTRIM(fe.payment_method), '') AS payment_method,
    fe.cost_center_id,
    fe.bank_account_id,
    fe.notes,
    fe.created_by,
    fe.created_at,
    fe.updated_at,
    fe.reconciled_at,
    COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') AS source_module
  FROM public.finance_entries fe
  WHERE COALESCE(fe.amount, 0) > 0
    AND COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') NOT IN ('finance_payables', 'finance_receivables', 'finance_commissions')
)
INSERT INTO public.finance_payables (
    source_entry_id,
    description,
    amount,
    paid_amount,
    due_date,
    competence_date,
    status,
    category,
    subcategory,
    counterparty_name,
    counterparty_type,
    payment_method,
    cost_center_id,
    bank_account_id,
    paid_at,
    notes,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    le.id,
    le.description,
    le.amount,
    CASE WHEN le.payment_status = 'paid' THEN le.amount ELSE 0 END AS paid_amount,
    le.due_date,
    le.competence_date,
    CASE
      WHEN le.payment_status = 'cancelled' THEN 'cancelled'
      WHEN le.payment_status = 'paid' THEN 'paid'
      WHEN le.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'open'
    END AS status,
    le.category,
    le.subcategory,
    le.counterparty_name,
    le.counterparty_type,
    le.payment_method,
    le.cost_center_id,
    le.bank_account_id,
    CASE
      WHEN le.payment_status = 'paid' THEN COALESCE(le.reconciled_at, le.updated_at, le.created_at, NOW())
      ELSE NULL
    END AS paid_at,
    le.notes,
    le.created_by,
    COALESCE(le.created_at, NOW()),
    NOW()
  FROM legacy_entries le
  WHERE le.entry_type = 'expense'
    AND NOT EXISTS (
      SELECT 1
      FROM public.finance_payables fp
      WHERE fp.source_entry_id = le.id
    )
;

WITH legacy_entries AS (
  SELECT
    fe.id,
    fe.entry_type,
    COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
    ABS(fe.amount)::NUMERIC(14,2) AS amount,
    COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS due_date,
    COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS competence_date,
    COALESCE(NULLIF(BTRIM(fe.payment_status), ''), 'paid') AS payment_status,
    NULLIF(BTRIM(fe.category), '') AS category,
    NULLIF(BTRIM(fe.subcategory), '') AS subcategory,
    NULLIF(BTRIM(fe.counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica') AS counterparty_type,
    NULLIF(BTRIM(fe.payment_method), '') AS payment_method,
    fe.cost_center_id,
    fe.bank_account_id,
    fe.notes,
    fe.created_by,
    fe.created_at,
    fe.updated_at,
    fe.reconciled_at,
    NULLIF(BTRIM(fe.reference_company), '') AS reference_company,
    NULLIF(BTRIM(fe.external_reference), '') AS external_reference,
    COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') AS source_module
  FROM public.finance_entries fe
  WHERE COALESCE(fe.amount, 0) > 0
    AND COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') NOT IN ('finance_payables', 'finance_receivables', 'finance_commissions')
)
INSERT INTO public.finance_receivables (
  source_entry_id,
  source_ref_type,
  source_ref_id,
  description,
  amount,
  received_amount,
  due_date,
  competence_date,
  status,
  category,
  subcategory,
  counterparty_name,
  counterparty_type,
  payment_method,
  cost_center_id,
  bank_account_id,
  received_at,
  notes,
  created_by,
  created_at,
  updated_at
)
SELECT
  le.id,
  COALESCE(le.reference_company, NULLIF(le.source_module, ''), 'finance_entry') AS source_ref_type,
  COALESCE(le.external_reference, le.id::text) AS source_ref_id,
  le.description,
  le.amount,
  CASE WHEN le.payment_status = 'paid' THEN le.amount ELSE 0 END AS received_amount,
  le.due_date,
  le.competence_date,
  CASE
    WHEN le.payment_status = 'cancelled' THEN 'cancelled'
    WHEN le.payment_status = 'paid' THEN 'received'
    WHEN le.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS status,
  le.category,
  le.subcategory,
  le.counterparty_name,
  le.counterparty_type,
  le.payment_method,
  le.cost_center_id,
  le.bank_account_id,
  CASE
    WHEN le.payment_status = 'paid' THEN COALESCE(le.reconciled_at, le.updated_at, le.created_at, NOW())
    ELSE NULL
  END AS received_at,
  le.notes,
  le.created_by,
  COALESCE(le.created_at, NOW()),
  NOW()
FROM legacy_entries le
WHERE le.entry_type = 'income'
  AND NOT EXISTS (
    SELECT 1
    FROM public.finance_receivables fr
    WHERE fr.source_entry_id = le.id
  );

-- =========================================================
-- Normalize AP/AR status consistency
-- =========================================================

WITH normalized AS (
  SELECT
    p.id,
    LEAST(GREATEST(COALESCE(p.paid_amount, 0), 0), p.amount) AS next_paid_amount,
    CASE
      WHEN p.status = 'cancelled' THEN 'cancelled'
      WHEN LEAST(GREATEST(COALESCE(p.paid_amount, 0), 0), p.amount) >= p.amount THEN 'paid'
      WHEN LEAST(GREATEST(COALESCE(p.paid_amount, 0), 0), p.amount) > 0 THEN 'partially_paid'
      WHEN p.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'open'
    END AS next_status,
    CASE
      WHEN LEAST(GREATEST(COALESCE(p.paid_amount, 0), 0), p.amount) > 0 THEN COALESCE(p.paid_at, p.updated_at, p.created_at, NOW())
      ELSE NULL
    END AS next_paid_at
  FROM public.finance_payables p
)
UPDATE public.finance_payables p
SET
  paid_amount = n.next_paid_amount,
  status = n.next_status,
  paid_at = n.next_paid_at
FROM normalized n
WHERE p.id = n.id
  AND (
    p.paid_amount IS DISTINCT FROM n.next_paid_amount
    OR p.status IS DISTINCT FROM n.next_status
    OR p.paid_at IS DISTINCT FROM n.next_paid_at
  );

WITH normalized AS (
  SELECT
    r.id,
    LEAST(GREATEST(COALESCE(r.received_amount, 0), 0), r.amount) AS next_received_amount,
    CASE
      WHEN r.status = 'cancelled' THEN 'cancelled'
      WHEN LEAST(GREATEST(COALESCE(r.received_amount, 0), 0), r.amount) >= r.amount THEN 'received'
      WHEN LEAST(GREATEST(COALESCE(r.received_amount, 0), 0), r.amount) > 0 THEN 'partially_received'
      WHEN r.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'open'
    END AS next_status,
    CASE
      WHEN LEAST(GREATEST(COALESCE(r.received_amount, 0), 0), r.amount) > 0 THEN COALESCE(r.received_at, r.updated_at, r.created_at, NOW())
      ELSE NULL
    END AS next_received_at
  FROM public.finance_receivables r
)
UPDATE public.finance_receivables r
SET
  received_amount = n.next_received_amount,
  status = n.next_status,
  received_at = n.next_received_at
FROM normalized n
WHERE r.id = n.id
  AND (
    r.received_amount IS DISTINCT FROM n.next_received_amount
    OR r.status IS DISTINCT FROM n.next_status
    OR r.received_at IS DISTINCT FROM n.next_received_at
  );

-- =========================================================
-- Populate catalogs from AP/AR + legacy entries (idempotent)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL DEFAULT 'both' CHECK (entry_type IN ('income', 'expense', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.finance_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS public.finance_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  party_type TEXT NOT NULL DEFAULT 'pessoa_juridica' CHECK (party_type IN ('pessoa_fisica', 'pessoa_juridica')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH category_usage AS (
  SELECT
    category_name,
    BOOL_OR(entry_type = 'income') AS has_income,
    BOOL_OR(entry_type = 'expense') AS has_expense
  FROM (
    SELECT NULLIF(BTRIM(fe.category), '') AS category_name, fe.entry_type
    FROM public.finance_entries fe
    UNION ALL
    SELECT NULLIF(BTRIM(fr.category), '') AS category_name, 'income'::TEXT AS entry_type
    FROM public.finance_receivables fr
    UNION ALL
    SELECT NULLIF(BTRIM(fp.category), '') AS category_name, 'expense'::TEXT AS entry_type
    FROM public.finance_payables fp
  ) raw
  WHERE category_name IS NOT NULL
  GROUP BY category_name
)
INSERT INTO public.finance_categories (name, entry_type, is_active, updated_at)
SELECT
  cu.category_name,
  CASE
    WHEN cu.has_income AND cu.has_expense THEN 'both'
    WHEN cu.has_income THEN 'income'
    ELSE 'expense'
  END,
  TRUE,
  NOW()
FROM category_usage cu
ON CONFLICT (name) DO UPDATE
SET
  entry_type = EXCLUDED.entry_type,
  is_active = TRUE,
  updated_at = NOW();

WITH all_subcategories AS (
  SELECT DISTINCT
    NULLIF(BTRIM(category), '') AS category_name,
    NULLIF(BTRIM(subcategory), '') AS subcategory_name
  FROM public.finance_entries
  UNION
  SELECT DISTINCT
    NULLIF(BTRIM(category), '') AS category_name,
    NULLIF(BTRIM(subcategory), '') AS subcategory_name
  FROM public.finance_payables
  UNION
  SELECT DISTINCT
    NULLIF(BTRIM(category), '') AS category_name,
    NULLIF(BTRIM(subcategory), '') AS subcategory_name
  FROM public.finance_receivables
)
INSERT INTO public.finance_subcategories (category_id, name, is_active, updated_at)
SELECT
  fc.id,
  s.subcategory_name,
  TRUE,
  NOW()
FROM all_subcategories s
JOIN public.finance_categories fc
  ON fc.name = s.category_name
WHERE s.category_name IS NOT NULL
  AND s.subcategory_name IS NOT NULL
ON CONFLICT (category_id, name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.finance_payment_methods (name, is_active, updated_at)
SELECT DISTINCT
  payment_method_name,
  TRUE,
  NOW()
FROM (
  SELECT NULLIF(BTRIM(payment_method), '') AS payment_method_name FROM public.finance_entries
  UNION
  SELECT NULLIF(BTRIM(payment_method), '') AS payment_method_name FROM public.finance_payables
  UNION
  SELECT NULLIF(BTRIM(payment_method), '') AS payment_method_name FROM public.finance_receivables
) pm
WHERE payment_method_name IS NOT NULL
ON CONFLICT (name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.finance_counterparties (name, party_type, is_active, updated_at)
SELECT DISTINCT
  counterparty_name,
  counterparty_type,
  TRUE,
  NOW()
FROM (
  SELECT
    NULLIF(BTRIM(counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(counterparty_type), ''), 'pessoa_juridica') AS counterparty_type
  FROM public.finance_entries
  UNION
  SELECT
    NULLIF(BTRIM(counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(counterparty_type), ''), 'pessoa_juridica') AS counterparty_type
  FROM public.finance_payables
  UNION
  SELECT
    NULLIF(BTRIM(counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(counterparty_type), ''), 'pessoa_juridica') AS counterparty_type
  FROM public.finance_receivables
) cp
WHERE counterparty_name IS NOT NULL
ON CONFLICT (name) DO UPDATE
SET
  party_type = EXCLUDED.party_type,
  is_active = TRUE,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_finance_payables_source_entry_id ON public.finance_payables(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_finance_receivables_source_entry_id ON public.finance_receivables(source_entry_id);

COMMIT;
