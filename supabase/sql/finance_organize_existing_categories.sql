-- ===============================================================
-- FINANCEIRO ERP - ORGANIZACAO DE CATEGORIAS/SUBCATEGORIAS EXISTENTES
-- ===============================================================

BEGIN;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS reference_company TEXT;

UPDATE public.finance_entries
SET category = TRIM(category)
WHERE category IS NOT NULL;

UPDATE public.finance_entries
SET subcategory = TRIM(subcategory)
WHERE subcategory IS NOT NULL;

-- Normaliza categorias com nomes ruins/variantes
UPDATE public.finance_entries
SET category = CASE
  WHEN category = 'System.Xml.XmlElement' THEN 'Estrutura'
  WHEN category = 'Life Style' THEN 'Lifestyle'
  WHEN category = 'Jurídico' THEN 'Juridico'
  WHEN category = 'Manutenção despesas' THEN 'Manutencao despesas'
  ELSE category
END
WHERE category IS NOT NULL;

-- Extrai subcategoria a partir do campo notes quando existe "Subcategoria:"
UPDATE public.finance_entries
SET subcategory = NULLIF(TRIM(SPLIT_PART(SPLIT_PART(notes, 'Subcategoria:', 2), '|', 1)), '')
WHERE (subcategory IS NULL OR TRIM(subcategory) = '')
  AND notes IS NOT NULL
  AND notes ILIKE '%Subcategoria:%';

-- Fallback: usa descricao "Despesa - X" / "Comissao - X" como subcategoria
UPDATE public.finance_entries
SET subcategory = NULLIF(TRIM(SPLIT_PART(description, '-', 2)), '')
WHERE (subcategory IS NULL OR TRIM(subcategory) = '')
  AND description LIKE '%-%';

UPDATE public.finance_entries
SET payment_status = COALESCE(NULLIF(TRIM(payment_status), ''), 'paid')
WHERE payment_status IS NULL OR TRIM(payment_status) = '';

UPDATE public.finance_entries
SET counterparty_type = COALESCE(NULLIF(TRIM(counterparty_type), ''), 'pessoa_juridica')
WHERE counterparty_type IS NULL OR TRIM(counterparty_type) = '';

-- Garante cadastros ERP (caso ainda nao existam)
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

ALTER TABLE public.finance_categories
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS entry_type TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND column_name = 'category_name'
  ) THEN
    EXECUTE '
      UPDATE public.finance_categories
      SET name = COALESCE(NULLIF(TRIM(name), ''''), NULLIF(TRIM(category_name), ''''))
      WHERE name IS NULL OR TRIM(name) = ''''
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND column_name = 'category'
  ) THEN
    EXECUTE '
      UPDATE public.finance_categories
      SET name = COALESCE(NULLIF(TRIM(name), ''''), NULLIF(TRIM(category), ''''))
      WHERE name IS NULL OR TRIM(name) = ''''
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND column_name = 'label'
  ) THEN
    EXECUTE '
      UPDATE public.finance_categories
      SET name = COALESCE(NULLIF(TRIM(name), ''''), NULLIF(TRIM(label), ''''))
      WHERE name IS NULL OR TRIM(name) = ''''
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND column_name = 'title'
  ) THEN
    EXECUTE '
      UPDATE public.finance_categories
      SET name = COALESCE(NULLIF(TRIM(name), ''''), NULLIF(TRIM(title), ''''))
      WHERE name IS NULL OR TRIM(name) = ''''
    ';
  END IF;
END $$;

UPDATE public.finance_categories
SET name = COALESCE(NULLIF(TRIM(name), ''), 'Categoria ' || SUBSTRING(id::text, 1, 8))
WHERE name IS NULL OR TRIM(name) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND column_name = 'category'
  ) THEN
    EXECUTE '
      UPDATE public.finance_categories
      SET category = COALESCE(
        NULLIF(TRIM(category), ''''),
        NULLIF(TRIM(name), ''''),
        ''Categoria '' || SUBSTRING(id::text, 1, 8)
      )
      WHERE category IS NULL OR TRIM(category) = ''''
    ';

    EXECUTE '
      UPDATE public.finance_categories
      SET name = COALESCE(NULLIF(TRIM(name), ''''), NULLIF(TRIM(category), ''''))
      WHERE name IS NULL OR TRIM(name) = ''''
    ';

    EXECUTE 'ALTER TABLE public.finance_categories ALTER COLUMN category DROP NOT NULL';
  END IF;
END $$;

WITH duplicated AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(name))
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.finance_categories
  WHERE name IS NOT NULL AND TRIM(name) <> ''
)
UPDATE public.finance_categories c
SET name = c.name || ' (' || duplicated.rn::text || ')'
FROM duplicated
WHERE c.id = duplicated.id
  AND duplicated.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_categories_name
ON public.finance_categories(name);

ALTER TABLE public.finance_categories
  ALTER COLUMN name SET NOT NULL;

UPDATE public.finance_categories
SET entry_type = COALESCE(NULLIF(TRIM(entry_type), ''), 'both')
WHERE entry_type IS NULL OR TRIM(entry_type) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'finance_categories'
      AND constraint_name = 'finance_categories_entry_type_check'
  ) THEN
    ALTER TABLE public.finance_categories
      ADD CONSTRAINT finance_categories_entry_type_check
      CHECK (entry_type IN ('income', 'expense', 'both'));
  END IF;
END $$;

-- Upsert de categorias reais dos lancamentos
WITH typed AS (
  SELECT
    TRIM(category) AS name,
    BOOL_OR(entry_type = 'income') AS has_income,
    BOOL_OR(entry_type = 'expense') AS has_expense
  FROM public.finance_entries
  WHERE category IS NOT NULL AND TRIM(category) <> ''
  GROUP BY TRIM(category)
)
INSERT INTO public.finance_categories (name, entry_type, is_active, updated_at)
SELECT
  t.name,
  CASE
    WHEN t.has_income AND t.has_expense THEN 'both'
    WHEN t.has_income THEN 'income'
    ELSE 'expense'
  END AS entry_type,
  TRUE,
  NOW()
FROM typed t
ON CONFLICT (name) DO UPDATE
SET
  entry_type = EXCLUDED.entry_type,
  is_active = TRUE,
  updated_at = NOW();

-- Upsert de subcategorias reais dos lancamentos
WITH base AS (
  SELECT DISTINCT
    TRIM(fe.category) AS category_name,
    TRIM(fe.subcategory) AS sub_name
  FROM public.finance_entries fe
  WHERE fe.category IS NOT NULL AND TRIM(fe.category) <> ''
    AND fe.subcategory IS NOT NULL AND TRIM(fe.subcategory) <> ''
)
INSERT INTO public.finance_subcategories (category_id, name, is_active, updated_at)
SELECT
  fc.id,
  b.sub_name,
  TRUE,
  NOW()
FROM base b
JOIN public.finance_categories fc
  ON fc.name = b.category_name
ON CONFLICT (category_id, name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

-- Upsert de formas de pagamento existentes
INSERT INTO public.finance_payment_methods (name, is_active, updated_at)
SELECT DISTINCT
  TRIM(payment_method) AS name,
  TRUE,
  NOW()
FROM public.finance_entries
WHERE payment_method IS NOT NULL
  AND TRIM(payment_method) <> ''
ON CONFLICT (name) DO UPDATE
SET
  is_active = TRUE,
  updated_at = NOW();

-- Upsert de favorecidos existentes
INSERT INTO public.finance_counterparties (name, party_type, is_active, updated_at)
SELECT DISTINCT
  TRIM(counterparty_name) AS name,
  COALESCE(NULLIF(TRIM(counterparty_type), ''), 'pessoa_juridica') AS party_type,
  TRUE,
  NOW()
FROM public.finance_entries
WHERE counterparty_name IS NOT NULL
  AND TRIM(counterparty_name) <> ''
ON CONFLICT (name) DO UPDATE
SET
  party_type = EXCLUDED.party_type,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
