-- ===============================================================
-- FINANCEIRO - FINALIZACAO DOS DADOS REAIS IMPORTADOS (IDEMPOTENTE)
-- Date: 2026-04-23
-- Goal:
--   - organizar lancamentos reais importados da planilha
--   - preencher lacunas de cadastro (favorecido/centro de custo)
--   - garantir AP/AR refletindo finance_entries sem duplicar
--   - manter tudo nao destrutivo
-- ===============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 0) Compatibilidade minima de schema (nao destrutivo)
-- ---------------------------------------------------------------
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS reference_company TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS competence_date DATE,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

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

CREATE TABLE IF NOT EXISTS public.finance_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 1) Normalizacao de texto basica (trim + espacos)
-- ---------------------------------------------------------------
UPDATE public.finance_entries
SET
  description = NULLIF(REGEXP_REPLACE(BTRIM(description), '\s+', ' ', 'g'), ''),
  category = NULLIF(REGEXP_REPLACE(BTRIM(category), '\s+', ' ', 'g'), ''),
  subcategory = NULLIF(REGEXP_REPLACE(BTRIM(subcategory), '\s+', ' ', 'g'), ''),
  payment_method = NULLIF(REGEXP_REPLACE(BTRIM(payment_method), '\s+', ' ', 'g'), ''),
  counterparty_name = NULLIF(REGEXP_REPLACE(BTRIM(counterparty_name), '\s+', ' ', 'g'), ''),
  reference_company = NULLIF(REGEXP_REPLACE(BTRIM(reference_company), '\s+', ' ', 'g'), ''),
  notes = NULLIF(REGEXP_REPLACE(BTRIM(notes), '\s+', ' ', 'g'), '')
WHERE TRUE;

UPDATE public.finance_entries
SET category = CASE
  WHEN category IN ('System.Xml.XmlElement') THEN 'Estrutura'
  WHEN LOWER(category) IN ('life style') THEN 'Lifestyle'
  WHEN category IN ('Juridico', 'JurÃ­dico', 'Jurídico') THEN 'Juridico'
  WHEN category IN ('Manutencao despesas', 'ManutenÃ§Ã£o despesas', 'Manutenção despesas') THEN 'Manutencao despesas'
  ELSE category
END
WHERE category IS NOT NULL;

UPDATE public.finance_entries
SET payment_method = CASE
  WHEN payment_method IS NULL OR BTRIM(payment_method) = '' THEN NULL
  WHEN LOWER(BTRIM(payment_method)) IN ('pix') THEN 'PIX'
  WHEN LOWER(BTRIM(payment_method)) IN ('boleto') THEN 'Boleto'
  WHEN LOWER(BTRIM(payment_method)) IN ('cartao', 'cartão', 'credito', 'débito', 'debito') THEN 'Cartao'
  WHEN LOWER(BTRIM(payment_method)) IN ('transferencia', 'transferência', 'ted', 'doc') THEN 'Transferencia'
  ELSE payment_method
END
WHERE payment_method IS NOT NULL;

UPDATE public.finance_entries
SET payment_status = CASE
  WHEN payment_status IS NULL OR BTRIM(payment_status) = '' THEN 'paid'
  WHEN LOWER(BTRIM(payment_status)) IN ('pago', 'paid', 'quitado', 'liquidado', 'recebido', 'recebida') THEN 'paid'
  WHEN LOWER(BTRIM(payment_status)) IN ('pendente', 'pending', 'aberto', 'open', 'vencido', 'vencida', 'a vencer') THEN 'pending'
  WHEN LOWER(BTRIM(payment_status)) IN ('cancelado', 'cancelada', 'cancelled', 'canceled', 'estornado', 'estornada') THEN 'cancelled'
  ELSE 'pending'
END;

UPDATE public.finance_entries
SET counterparty_type = CASE
  WHEN counterparty_type IS NULL OR BTRIM(counterparty_type) = '' THEN 'pessoa_juridica'
  WHEN LOWER(BTRIM(counterparty_type)) IN ('pf', 'pessoa fisica', 'pessoa_fisica', 'fisica', 'física') THEN 'pessoa_fisica'
  WHEN LOWER(BTRIM(counterparty_type)) IN ('pj', 'pessoa juridica', 'pessoa_juridica', 'juridica', 'jurídica') THEN 'pessoa_juridica'
  ELSE 'pessoa_juridica'
END;

UPDATE public.finance_entries
SET due_date = COALESCE(due_date, entry_date, created_at::date, CURRENT_DATE)
WHERE due_date IS NULL;

UPDATE public.finance_entries
SET competence_date = COALESCE(competence_date, due_date, entry_date, created_at::date, CURRENT_DATE)
WHERE competence_date IS NULL;

-- ---------------------------------------------------------------
-- 2) Enriquecimento de subcategoria/favorecido/referencia
-- ---------------------------------------------------------------

-- Extrai "Subcategoria: X" das observacoes quando faltar subcategoria.
UPDATE public.finance_entries fe
SET subcategory = NULLIF(
  REGEXP_REPLACE(
    BTRIM((regexp_match(fe.notes, '(?i)Subcategoria:\s*([^|]+)'))[1]),
    '\s+', ' ', 'g'
  ),
  ''
)
WHERE (fe.subcategory IS NULL OR BTRIM(fe.subcategory) = '')
  AND fe.notes ~* 'Subcategoria:\s*[^|]+';

-- Fallback de subcategoria por descricao "X - Y".
UPDATE public.finance_entries
SET subcategory = NULLIF(REGEXP_REPLACE(BTRIM(SPLIT_PART(description, '-', 2)), '\s+', ' ', 'g'), '')
WHERE (subcategory IS NULL OR BTRIM(subcategory) = '')
  AND description LIKE '%-%';

-- Origem de recebimento vinda de notes ("Origem: ...").
UPDATE public.finance_entries fe
SET counterparty_name = NULLIF(
  REGEXP_REPLACE(
    BTRIM((regexp_match(fe.notes, '(?i)Origem:\s*([^|]+)'))[1]),
    '\s+', ' ', 'g'
  ),
  ''
)
WHERE (fe.counterparty_name IS NULL OR BTRIM(fe.counterparty_name) = '')
  AND fe.notes ~* 'Origem:\s*[^|]+';

-- Para Prestadores, usa a descricao como favorecido quando faltar.
UPDATE public.finance_entries fe
SET counterparty_name = NULLIF(BTRIM(fe.description), '')
WHERE (fe.counterparty_name IS NULL OR BTRIM(fe.counterparty_name) = '')
  AND fe.entry_type = 'expense'
  AND COALESCE(fe.category, '') ILIKE 'Prestadores%'
  AND fe.description IS NOT NULL
  AND fe.description NOT ILIKE 'Despesa - %';

-- Fallback geral por descricao "X - Y" -> favorecido = Y.
UPDATE public.finance_entries
SET counterparty_name = NULLIF(REGEXP_REPLACE(BTRIM(SPLIT_PART(description, '-', 2)), '\s+', ' ', 'g'), '')
WHERE (counterparty_name IS NULL OR BTRIM(counterparty_name) = '')
  AND description LIKE '%-%';

-- Em Prestadores, sem tipo informado, prioriza pessoa fisica.
UPDATE public.finance_entries
SET counterparty_type = 'pessoa_fisica'
WHERE COALESCE(category, '') ILIKE 'Prestadores%'
  AND (counterparty_type IS NULL OR BTRIM(counterparty_type) = '' OR counterparty_type = 'pessoa_juridica')
  AND counterparty_name IS NOT NULL;

-- Usa "Responsavel: X" como referencia de centro quando estiver vazio.
UPDATE public.finance_entries fe
SET reference_company = NULLIF(
  REGEXP_REPLACE(
    BTRIM((regexp_match(fe.notes, '(?i)Responsavel:\s*([^|]+)'))[1]),
    '\s+', ' ', 'g'
  ),
  ''
)
WHERE (fe.reference_company IS NULL OR BTRIM(fe.reference_company) = '')
  AND fe.notes ~* 'Responsavel:\s*[^|]+';

-- ---------------------------------------------------------------
-- 3) Centro de custo por referencia (quando vazio)
-- ---------------------------------------------------------------
WITH center_names AS (
  SELECT DISTINCT
    NULLIF(BTRIM(reference_company), '') AS center_name
  FROM public.finance_entries
  WHERE reference_company IS NOT NULL
    AND BTRIM(reference_company) <> ''
)
INSERT INTO public.finance_cost_centers (name, code, is_active, updated_at)
SELECT
  cn.center_name,
  NULL,
  TRUE,
  NOW()
FROM center_names cn
WHERE cn.center_name IS NOT NULL
ON CONFLICT (name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

UPDATE public.finance_entries fe
SET cost_center_id = fcc.id
FROM public.finance_cost_centers fcc
WHERE fe.cost_center_id IS NULL
  AND NULLIF(BTRIM(fe.reference_company), '') IS NOT NULL
  AND fcc.name = BTRIM(fe.reference_company);

-- ---------------------------------------------------------------
-- 4) Garante AP/AR para todos os lancamentos do legado (sem duplicar)
-- ---------------------------------------------------------------
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
  fe.id,
  COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
  ABS(fe.amount)::NUMERIC(14,2) AS amount,
  CASE WHEN fe.payment_status = 'paid' THEN ABS(fe.amount)::NUMERIC(14,2) ELSE 0 END AS paid_amount,
  COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE),
  COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE),
  CASE
    WHEN fe.payment_status = 'cancelled' THEN 'cancelled'
    WHEN fe.payment_status = 'paid' THEN 'paid'
    WHEN COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS status,
  NULLIF(BTRIM(fe.category), ''),
  NULLIF(BTRIM(fe.subcategory), ''),
  NULLIF(BTRIM(fe.counterparty_name), ''),
  COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica'),
  NULLIF(BTRIM(fe.payment_method), ''),
  fe.cost_center_id,
  fe.bank_account_id,
  CASE WHEN fe.payment_status = 'paid' THEN COALESCE(fe.updated_at, fe.created_at, NOW()) ELSE NULL END,
  fe.notes,
  fe.created_by,
  COALESCE(fe.created_at, NOW()),
  NOW()
FROM public.finance_entries fe
WHERE fe.entry_type = 'expense'
  AND COALESCE(fe.amount, 0) > 0
  AND COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') NOT IN ('finance_payables', 'finance_receivables', 'finance_commissions')
  AND NOT EXISTS (
    SELECT 1
    FROM public.finance_payables fp
    WHERE fp.source_entry_id = fe.id
  );

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
  fe.id,
  COALESCE(NULLIF(BTRIM(fe.reference_company), ''), NULLIF(BTRIM(fe.source_module), ''), 'finance_entry') AS source_ref_type,
  COALESCE(NULLIF(BTRIM(fe.external_reference), ''), fe.id::text) AS source_ref_id,
  COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
  ABS(fe.amount)::NUMERIC(14,2) AS amount,
  CASE WHEN fe.payment_status = 'paid' THEN ABS(fe.amount)::NUMERIC(14,2) ELSE 0 END AS received_amount,
  COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE),
  COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE),
  CASE
    WHEN fe.payment_status = 'cancelled' THEN 'cancelled'
    WHEN fe.payment_status = 'paid' THEN 'received'
    WHEN COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS status,
  NULLIF(BTRIM(fe.category), ''),
  NULLIF(BTRIM(fe.subcategory), ''),
  NULLIF(BTRIM(fe.counterparty_name), ''),
  COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica'),
  NULLIF(BTRIM(fe.payment_method), ''),
  fe.cost_center_id,
  fe.bank_account_id,
  CASE WHEN fe.payment_status = 'paid' THEN COALESCE(fe.updated_at, fe.created_at, NOW()) ELSE NULL END,
  fe.notes,
  fe.created_by,
  COALESCE(fe.created_at, NOW()),
  NOW()
FROM public.finance_entries fe
WHERE fe.entry_type = 'income'
  AND COALESCE(fe.amount, 0) > 0
  AND COALESCE(NULLIF(BTRIM(fe.source_module), ''), '') NOT IN ('finance_payables', 'finance_receivables', 'finance_commissions')
  AND NOT EXISTS (
    SELECT 1
    FROM public.finance_receivables fr
    WHERE fr.source_entry_id = fe.id
  );

-- Atualiza AP/AR existente com campos vazios, sem sobrescrever edicoes manuais.
WITH src AS (
  SELECT
    fe.id AS source_entry_id,
    COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
    ABS(fe.amount)::NUMERIC(14,2) AS amount,
    COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS due_date,
    COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS competence_date,
    NULLIF(BTRIM(fe.category), '') AS category,
    NULLIF(BTRIM(fe.subcategory), '') AS subcategory,
    NULLIF(BTRIM(fe.counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica') AS counterparty_type,
    NULLIF(BTRIM(fe.payment_method), '') AS payment_method,
    fe.cost_center_id,
    fe.bank_account_id,
    fe.notes
  FROM public.finance_entries fe
)
UPDATE public.finance_payables fp
SET
  description = COALESCE(NULLIF(BTRIM(fp.description), ''), src.description),
  amount = COALESCE(fp.amount, src.amount),
  due_date = COALESCE(fp.due_date, src.due_date),
  competence_date = COALESCE(fp.competence_date, src.competence_date),
  category = COALESCE(NULLIF(BTRIM(fp.category), ''), src.category),
  subcategory = COALESCE(NULLIF(BTRIM(fp.subcategory), ''), src.subcategory),
  counterparty_name = COALESCE(NULLIF(BTRIM(fp.counterparty_name), ''), src.counterparty_name),
  counterparty_type = COALESCE(NULLIF(BTRIM(fp.counterparty_type), ''), src.counterparty_type),
  payment_method = COALESCE(NULLIF(BTRIM(fp.payment_method), ''), src.payment_method),
  cost_center_id = COALESCE(fp.cost_center_id, src.cost_center_id),
  bank_account_id = COALESCE(fp.bank_account_id, src.bank_account_id),
  notes = COALESCE(NULLIF(BTRIM(fp.notes), ''), src.notes),
  updated_at = NOW()
FROM src
WHERE fp.source_entry_id = src.source_entry_id;

WITH src AS (
  SELECT
    fe.id AS source_entry_id,
    COALESCE(NULLIF(BTRIM(fe.description), ''), 'Lancamento ' || SUBSTRING(fe.id::text, 1, 8)) AS description,
    ABS(fe.amount)::NUMERIC(14,2) AS amount,
    COALESCE(fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS due_date,
    COALESCE(fe.competence_date, fe.due_date, fe.entry_date, fe.created_at::date, CURRENT_DATE) AS competence_date,
    NULLIF(BTRIM(fe.category), '') AS category,
    NULLIF(BTRIM(fe.subcategory), '') AS subcategory,
    NULLIF(BTRIM(fe.counterparty_name), '') AS counterparty_name,
    COALESCE(NULLIF(BTRIM(fe.counterparty_type), ''), 'pessoa_juridica') AS counterparty_type,
    NULLIF(BTRIM(fe.payment_method), '') AS payment_method,
    fe.cost_center_id,
    fe.bank_account_id,
    fe.notes
  FROM public.finance_entries fe
)
UPDATE public.finance_receivables fr
SET
  description = COALESCE(NULLIF(BTRIM(fr.description), ''), src.description),
  amount = COALESCE(fr.amount, src.amount),
  due_date = COALESCE(fr.due_date, src.due_date),
  competence_date = COALESCE(fr.competence_date, src.competence_date),
  category = COALESCE(NULLIF(BTRIM(fr.category), ''), src.category),
  subcategory = COALESCE(NULLIF(BTRIM(fr.subcategory), ''), src.subcategory),
  counterparty_name = COALESCE(NULLIF(BTRIM(fr.counterparty_name), ''), src.counterparty_name),
  counterparty_type = COALESCE(NULLIF(BTRIM(fr.counterparty_type), ''), src.counterparty_type),
  payment_method = COALESCE(NULLIF(BTRIM(fr.payment_method), ''), src.payment_method),
  cost_center_id = COALESCE(fr.cost_center_id, src.cost_center_id),
  bank_account_id = COALESCE(fr.bank_account_id, src.bank_account_id),
  notes = COALESCE(NULLIF(BTRIM(fr.notes), ''), src.notes),
  updated_at = NOW()
FROM src
WHERE fr.source_entry_id = src.source_entry_id;

-- ---------------------------------------------------------------
-- 5) Recarrega catalogos com base no dado organizado
-- ---------------------------------------------------------------
WITH typed AS (
  SELECT
    BTRIM(category) AS name,
    BOOL_OR(entry_type = 'income') AS has_income,
    BOOL_OR(entry_type = 'expense') AS has_expense
  FROM public.finance_entries
  WHERE category IS NOT NULL
    AND BTRIM(category) <> ''
  GROUP BY BTRIM(category)
)
INSERT INTO public.finance_categories (name, entry_type, is_active, updated_at)
SELECT
  t.name,
  CASE
    WHEN t.has_income AND t.has_expense THEN 'both'
    WHEN t.has_income THEN 'income'
    ELSE 'expense'
  END,
  TRUE,
  NOW()
FROM typed t
ON CONFLICT (name) DO UPDATE
SET
  entry_type = EXCLUDED.entry_type,
  is_active = TRUE,
  updated_at = NOW();

WITH sub_base AS (
  SELECT DISTINCT
    BTRIM(category) AS category_name,
    BTRIM(subcategory) AS sub_name
  FROM public.finance_entries
  WHERE category IS NOT NULL
    AND BTRIM(category) <> ''
    AND subcategory IS NOT NULL
    AND BTRIM(subcategory) <> ''
)
INSERT INTO public.finance_subcategories (category_id, name, is_active, updated_at)
SELECT
  fc.id,
  sb.sub_name,
  TRUE,
  NOW()
FROM sub_base sb
JOIN public.finance_categories fc
  ON fc.name = sb.category_name
ON CONFLICT (category_id, name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.finance_payment_methods (name, is_active, updated_at)
SELECT DISTINCT
  BTRIM(payment_method) AS name,
  TRUE,
  NOW()
FROM public.finance_entries
WHERE payment_method IS NOT NULL
  AND BTRIM(payment_method) <> ''
ON CONFLICT (name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.finance_counterparties (name, party_type, is_active, updated_at)
SELECT DISTINCT
  BTRIM(counterparty_name) AS name,
  COALESCE(NULLIF(BTRIM(counterparty_type), ''), 'pessoa_juridica') AS party_type,
  TRUE,
  NOW()
FROM public.finance_entries
WHERE counterparty_name IS NOT NULL
  AND BTRIM(counterparty_name) <> ''
ON CONFLICT (name) DO UPDATE
SET
  party_type = EXCLUDED.party_type,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;

-- ---------------------------------------------------------------
-- 6) Snapshot de verificacao apos organizacao
-- ---------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.finance_entries) AS entries_total,
  (SELECT COUNT(*) FROM public.finance_entries WHERE counterparty_name IS NULL OR BTRIM(counterparty_name) = '') AS entries_without_counterparty,
  (SELECT COUNT(*) FROM public.finance_entries WHERE cost_center_id IS NULL) AS entries_without_cost_center,
  (SELECT COUNT(*) FROM public.finance_payables WHERE source_entry_id IS NOT NULL) AS payables_linked_to_entries,
  (SELECT COUNT(*) FROM public.finance_receivables WHERE source_entry_id IS NOT NULL) AS receivables_linked_to_entries,
  (SELECT COUNT(*) FROM public.finance_categories) AS categories_total,
  (SELECT COUNT(*) FROM public.finance_subcategories) AS subcategories_total,
  (SELECT COUNT(*) FROM public.finance_counterparties) AS counterparties_total;
