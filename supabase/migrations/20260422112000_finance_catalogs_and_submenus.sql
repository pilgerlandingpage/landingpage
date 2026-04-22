-- Finance ERP catalogs (categorias, subcategorias, pagamentos e favorecidos)
-- Compatibilidade com base existente

BEGIN;

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

ALTER TABLE public.finance_subcategories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.finance_payment_methods
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.finance_counterparties
  ADD COLUMN IF NOT EXISTS party_type TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.finance_counterparties
SET party_type = COALESCE(NULLIF(TRIM(party_type), ''), 'pessoa_juridica')
WHERE party_type IS NULL OR TRIM(party_type) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'finance_counterparties'
      AND constraint_name = 'finance_counterparties_party_type_check'
  ) THEN
    ALTER TABLE public.finance_counterparties
      ADD CONSTRAINT finance_counterparties_party_type_check
      CHECK (party_type IN ('pessoa_fisica', 'pessoa_juridica'));
  END IF;
END $$;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_name TEXT,
  ADD COLUMN IF NOT EXISTS counterparty_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS reference_company TEXT;

UPDATE public.finance_entries
SET payment_status = COALESCE(NULLIF(TRIM(payment_status), ''), 'paid')
WHERE payment_status IS NULL OR TRIM(payment_status) = '';

UPDATE public.finance_entries
SET counterparty_type = 'pessoa_juridica'
WHERE counterparty_type IS NULL OR TRIM(counterparty_type) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'finance_entries'
      AND constraint_name = 'finance_entries_counterparty_type_check'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_counterparty_type_check
      CHECK (counterparty_type IN ('pessoa_fisica', 'pessoa_juridica'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'finance_entries'
      AND constraint_name = 'finance_entries_payment_status_check'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_payment_status_check
      CHECK (payment_status IN ('paid', 'pending', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.finance_entries
  ALTER COLUMN payment_status SET DEFAULT 'paid';

CREATE INDEX IF NOT EXISTS idx_finance_entries_subcategory ON public.finance_entries(subcategory);
CREATE INDEX IF NOT EXISTS idx_finance_entries_counterparty_name ON public.finance_entries(counterparty_name);
CREATE INDEX IF NOT EXISTS idx_finance_entries_payment_status ON public.finance_entries(payment_status);

CREATE INDEX IF NOT EXISTS idx_finance_subcategories_category_id ON public.finance_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_categories_type ON public.finance_categories(entry_type);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_counterparties ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_categories'
      AND policyname = 'service_role_full_access_finance_categories'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_categories"
      ON public.finance_categories
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_subcategories'
      AND policyname = 'service_role_full_access_finance_subcategories'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_subcategories"
      ON public.finance_subcategories
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_payment_methods'
      AND policyname = 'service_role_full_access_finance_payment_methods'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_payment_methods"
      ON public.finance_payment_methods
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_counterparties'
      AND policyname = 'service_role_full_access_finance_counterparties'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_counterparties"
      ON public.finance_counterparties
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Seeds basicos para iniciar ERP financeiro
INSERT INTO public.finance_categories (name, entry_type)
VALUES
  ('Marketing', 'expense'),
  ('Custos Fixos', 'expense'),
  ('Prestadores', 'expense'),
  ('Tributos', 'expense'),
  ('Consumo despesas', 'expense'),
  ('Manutencao despesas', 'expense'),
  ('Estrutura', 'expense'),
  ('Lifestyle', 'expense'),
  ('Juridico', 'expense'),
  ('Recebimentos', 'income')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.finance_payment_methods (name)
VALUES
  ('PIX'),
  ('Cartao'),
  ('Boleto'),
  ('TED'),
  ('DOC'),
  ('Dinheiro')
ON CONFLICT (name) DO NOTHING;

WITH cat AS (
  SELECT id, name FROM public.finance_categories
)
INSERT INTO public.finance_subcategories (category_id, name)
SELECT c.id, s.sub_name
FROM cat c
JOIN (
  VALUES
    ('Marketing', 'Google Ads'),
    ('Marketing', 'Meta Ads'),
    ('Marketing', 'Outdoor'),
    ('Custos Fixos', 'Aluguel'),
    ('Custos Fixos', 'Internet'),
    ('Custos Fixos', 'Site'),
    ('Custos Fixos', 'Contabilidade'),
    ('Prestadores', 'Gestor Comercial'),
    ('Prestadores', 'Gestor Operacional'),
    ('Prestadores', 'Secretaria'),
    ('Prestadores', 'Comissoes'),
    ('Tributos', 'Tributos gerais'),
    ('Consumo despesas', 'Administrativo'),
    ('Manutencao despesas', 'Administrativo'),
    ('Estrutura', 'Moveis loja'),
    ('Lifestyle', 'Barco'),
    ('Lifestyle', 'Porsche 911'),
    ('Juridico', 'Contrato'),
    ('Recebimentos', 'Comissoes'),
    ('Recebimentos', 'Mensalidades'),
    ('Recebimentos', 'Campanhas')
) AS s(cat_name, sub_name)
  ON s.cat_name = c.name
ON CONFLICT (category_id, name) DO NOTHING;

COMMIT;
