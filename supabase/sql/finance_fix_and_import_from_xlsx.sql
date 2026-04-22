-- ==============================================
-- FINANCEIRO PILGER - CORRECAO + IMPORTACAO XLSX
-- Arquivo origem: FINANCEIRO PILGER.xlsx
-- ==============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category TEXT,
  entry_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='finance_entries' AND column_name='date'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='finance_entries' AND column_name='entry_date'
  ) THEN
    EXECUTE 'ALTER TABLE public.finance_entries RENAME COLUMN date TO entry_date';
  END IF;
END $$;

ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS entry_type TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Normaliza tipos legados para o padrao do novo modulo
UPDATE public.finance_entries
SET entry_type = CASE
  WHEN entry_type IS NULL THEN 'expense'
  WHEN lower(trim(entry_type)) IN ('income', 'receita', 'entrada', 'credito', 'credit') THEN 'income'
  WHEN lower(trim(entry_type)) IN ('expense', 'despesa', 'saida', 'debito', 'debit') THEN 'expense'
  ELSE 'expense'
END;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'finance_entries'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'entry_type'
  LOOP
    EXECUTE format('ALTER TABLE public.finance_entries DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'finance_entries'
      AND constraint_name = 'finance_entries_entry_type_check'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_entry_type_check
      CHECK (entry_type IN ('income', 'expense'));
  END IF;
END $$;

UPDATE public.finance_entries
SET entry_date = COALESCE(
  entry_date,
  (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at::date,
  CURRENT_DATE
)
WHERE entry_date IS NULL;

ALTER TABLE public.finance_entries
  ALTER COLUMN entry_date SET NOT NULL;

UPDATE public.finance_entries
SET occurred_at = COALESCE(
  occurred_at,
  ((entry_date::timestamp + INTERVAL '12 hours') AT TIME ZONE 'America/Sao_Paulo'),
  created_at,
  NOW()
)
WHERE occurred_at IS NULL;

UPDATE public.finance_entries
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

UPDATE public.finance_entries
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.finance_entries
  ALTER COLUMN occurred_at SET DEFAULT NOW(),
  ALTER COLUMN occurred_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON public.finance_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_occurred_at ON public.finance_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON public.finance_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_finance_entries_category ON public.finance_entries(category);

INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES ('finance', 'Financeiro', 'Gestao financeira da empresa (receitas e despesas)', 'principal')
ON CONFLICT (module_key) DO NOTHING;

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_entries'
      AND policyname = 'service_role_full_access_finance_entries'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_entries"
      ON public.finance_entries
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Evita duplicacoes (para reexecucao)
WITH ranked_duplicates AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY description, entry_type, amount, entry_date
      ORDER BY created_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM public.finance_entries
)
DELETE FROM public.finance_entries fe
USING ranked_duplicates rd
WHERE fe.ctid = rd.ctid
  AND rd.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_entries_import_key
ON public.finance_entries (description, entry_type, amount, entry_date);

-- IMPORTACAO DA PLANILHA (Custos PJ + Recebimentos)
INSERT INTO public.finance_entries
(description, entry_type, amount, category, entry_date, payment_method, notes, created_at, updated_at)
VALUES('Internet escritório', 'expense', 179.00, 'Custos Fixos', '2026-03-11', 'Cartão', 'Subcategoria: Internet | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 17400.00, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Google Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 32791.42, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Meta Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Revisão contrato', 'expense', 3000.00, 'Jurídico', '2026-03-11', 'PIX', 'Subcategoria: Contrato | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Aluguel escritório', 'expense', 32307.00, 'Custos Fixos', '2026-03-11', 'PIX', 'Subcategoria: Aluguel | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('av brasil', 'expense', 3000.00, 'Marketing', '2026-03-11', 'PIX', 'Subcategoria: Outdoor | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Erick', 'expense', 8000.00, 'Prestadores', '2026-03-11', 'PIX', 'Subcategoria: Gestor Comercial | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Amanda', 'expense', 5000.00, 'Prestadores', '2026-03-11', 'PIX', 'Subcategoria: Gestor Operacional | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Giovanna', 'expense', 3500.00, 'Prestadores', '2026-03-11', 'PIX', 'Subcategoria: Secretária | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Comissoes', 'expense', 18615.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Comissoes | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Assertiva consultas', 'expense', 610.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Assertiva consultas | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 1510.00, 'Consumo despesas', '2026-03-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Tributos', 'expense', 27589.00, 'Tributos', '2026-03-10', 'Boleto', 'Subcategoria: Tributos | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Faxineira', 'expense', 2800.00, 'Custos Fixos', '2026-03-10', 'PIX', 'Subcategoria: Faxineira | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Contabilidade', 'expense', 855.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Contabilidade | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Celular', 'expense', 499.39, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Celular | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Site', 'expense', 368.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Site | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Araquari', 'expense', 25000.00, 'Marketing', '2026-03-10', 'PIX', 'Subcategoria: Outdoor | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('carlos dru.', 'expense', 11500.00, 'Marketing', '2026-03-10', 'PIX', 'Subcategoria: Outdoor | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Amanda', 'expense', 5000.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Gestor Operacional | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Giovanna', 'expense', 3500.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Secretária | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Laura', 'expense', 1550.00, 'Prestadores', '2026-03-10', 'PIX', 'Subcategoria: Edição | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Internet', 'expense', 179.90, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Internet | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Site', 'expense', 368.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Site | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Celular', 'expense', 499.39, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Celular | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Contabilidade', 'expense', 855.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Contabilidade | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Faxineira', 'expense', 2800.00, 'Custos Fixos', '2026-03-10', 'PIX', 'Subcategoria: Faxineira | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Erick', 'expense', 8000.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Gestor Comercial | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Magno', 'expense', 10000.00, 'Prestadores', '2026-03-13', 'PIX', 'Subcategoria: Tec | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Av Brasil', 'expense', 3000.00, 'Marketing', '2026-03-10', 'Boleto', 'Subcategoria: System.Xml.XmlElement | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Araquari', 'expense', 21823.00, 'Marketing', '2026-03-10', 'PIX', 'Subcategoria: Outdoor | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Tributos', 'expense', 56478.00, 'Tributos', '2026-03-10', 'Boleto', 'Subcategoria: Tributos | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 3260.00, 'Consumo despesas', '2026-03-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 807.50, 'Manutencao despesas', '2026-03-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Assertiva consultas', 'expense', 507.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Assertiva consultas | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Comissoes', 'expense', 9779.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Comissoes | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 22300.00, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Google Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 30469.60, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Meta Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Moveis loja', 'expense', 21761.00, 'System.Xml.XmlElement', '2026-03-10', 'Boleto', 'Subcategoria: Moveis loja | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Barco', 'expense', 1858.00, 'Life Style', '2026-03-10', 'Boleto', 'Subcategoria: Barco | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Aluguel escritório', 'expense', 32307.00, 'Custos Fixos', '2026-03-10', 'PIX', 'Subcategoria: Aluguel | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Amanda', 'expense', 5000.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Gestor Operacional | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Giovanna', 'expense', 3500.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Secretária | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Laura', 'expense', 1550.00, 'Prestadores', '2026-03-10', 'PIX', 'Subcategoria: Edição | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Internet', 'expense', 179.90, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Internet | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Site', 'expense', 368.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Site | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Celular', 'expense', 499.39, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Celular | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Contabilidade', 'expense', 855.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Contabilidade | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Faxineira', 'expense', 2800.00, 'Custos Fixos', '2026-03-10', 'PIX', 'Subcategoria: Faxineira | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Erick', 'expense', 8000.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Gestor Comercial | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Magno', 'expense', 10000.00, 'Prestadores', '2026-03-13', 'PIX', 'Subcategoria: Tec | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Av Brasil', 'expense', 3000.00, 'Marketing', '2026-03-10', 'Boleto', 'Subcategoria: System.Xml.XmlElement | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Araquari', 'expense', 21823.00, 'Marketing', '2026-03-10', 'PIX', 'Subcategoria: Outdoor | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Tributos', 'expense', 56478.00, 'Tributos', '2026-03-10', 'Boleto', 'Subcategoria: Tributos | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 3260.00, 'Consumo despesas', '2026-03-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 807.50, 'Manutencao despesas', '2026-03-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Assertiva consultas', 'expense', 507.00, 'Custos Fixos', '2026-03-10', 'Boleto', 'Subcategoria: Assertiva consultas | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Comissoes', 'expense', 9779.00, 'Prestadores', '2026-03-12', 'PIX', 'Subcategoria: Comissoes | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 20596.41, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Google Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Campanha geração leads', 'expense', 33934.36, 'Marketing', '2026-03-11', 'Cartão', 'Subcategoria: Meta Ads | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Moveis loja', 'expense', 21761.00, 'System.Xml.XmlElement', '2026-03-10', 'Boleto', 'Subcategoria: Moveis loja | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Barco', 'expense', 1858.00, 'Life Style', '2026-03-10', 'Boleto', 'Subcategoria: Barco | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Aluguel escritório', 'expense', 32307.00, 'Custos Fixos', '2026-03-10', 'PIX', 'Subcategoria: Aluguel | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Amanda', 'expense', 5000.00, 'Prestadores', '2026-04-10', 'PIX', 'Subcategoria: Gestor Operacional | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Giovanna', 'expense', 3500.00, 'Prestadores', '2026-04-10', 'PIX', 'Subcategoria: Secretária | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Internet', 'expense', 179.90, 'Custos Fixos', '2026-04-10', 'Boleto', 'Subcategoria: Internet | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Site', 'expense', 425.00, 'Custos Fixos', '2026-04-10', 'Boleto', 'Subcategoria: Site | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Celular', 'expense', 499.39, 'Custos Fixos', '2026-04-10', 'Boleto', 'Subcategoria: Celular | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Contabilidade', 'expense', 855.00, 'Custos Fixos', '2026-04-10', 'Boleto', 'Subcategoria: Contabilidade | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Faxineira', 'expense', 2800.00, 'Custos Fixos', '2026-04-10', 'PIX', 'Subcategoria: Faxineira | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Erick', 'expense', 8000.00, 'Prestadores', '2026-04-10', 'PIX', 'Subcategoria: Gestor Comercial | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Magno', 'expense', 10000.00, 'Prestadores', '2026-04-10', 'PIX', 'Subcategoria: Tec | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Tributos', 'expense', 125326.00, 'Tributos', '2026-04-10', 'Boleto', 'Subcategoria: Tributos | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 2035.00, 'Consumo despesas', '2026-04-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Administrativo', 'expense', 2290.00, 'Manutencao despesas', '2026-04-10', 'PIX', 'Subcategoria: Administrativo | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Assertiva consultas', 'expense', 727.00, 'Custos Fixos', '2026-04-10', 'Boleto', 'Subcategoria: Assertiva consultas | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Jurídico', 'expense', 7212.00, 'Jurídico', '2026-04-10', 'PIX', 'Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Moveis loja', 'expense', 21761.00, 'System.Xml.XmlElement', '2026-04-10', 'Boleto', 'Subcategoria: Moveis loja | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Barco', 'expense', 1850.00, 'Life Style', '2026-04-10', 'Boleto', 'Subcategoria: Barco | Tipo: Variável | Responsavel: Financeiro', NOW(), NOW()),
('Aluguel escritório', 'expense', 32307.00, 'Custos Fixos', '2026-04-10', 'PIX', 'Subcategoria: Aluguel | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Despesa - Porsche 911', 'expense', 24246.00, 'Life Style', '2026-04-10', 'Boleto', 'Subcategoria: Porsche 911 | Tipo: Fixo | Responsavel: Financeiro', NOW(), NOW()),
('Comissao - Senna', 'income', 36713.64, 'Recebimentos', '2026-01-30', NULL, 'Origem: Senna | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG North', 'income', 9850.00, 'Recebimentos', '2026-01-30', NULL, 'Origem: FG North | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG Garden', 'income', 6658.50, 'Recebimentos', '2026-01-30', NULL, 'Origem: FG Garden | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - Pasqualloto', 'income', 158782.50, 'Recebimentos', '2026-01-29', NULL, 'Origem: Pasqualloto | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Campanha - LD', 'income', 4925.00, 'Recebimentos', '2026-01-22', NULL, 'Origem: LD | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Recebimento - MAUro Bernardes - matheus ver Moov NF', 'income', 10500.00, 'Recebimentos', '2026-01-22', NULL, 'Origem: MAUro Bernardes - matheus ver Moov NF | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - N1', 'income', 1704.00, 'Recebimentos', '2026-01-22', NULL, 'Origem: N1 | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('mensalidade - Monica', 'income', 2806.45, 'Recebimentos', '2026-01-22', NULL, 'Origem: Monica | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Mobilia - Quanta - moveis', 'income', 20000.00, 'Recebimentos', '2026-01-20', NULL, 'Origem: Quanta - moveis | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - senna', 'income', 102536.13, 'Recebimentos', '2026-01-20', NULL, 'Origem: senna | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('mensalidade - matheus', 'income', 3000.00, 'Recebimentos', '2026-01-13', NULL, 'Origem: matheus | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('mensalidade - Beitiner', 'income', 3000.00, 'Recebimentos', '2026-01-12', NULL, 'Origem: Beitiner | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('mensalidade - Drieli', 'income', 3000.00, 'Recebimentos', '2026-01-12', NULL, 'Origem: Drieli | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Emily', 'income', 3000.00, 'Recebimentos', '2026-01-12', NULL, 'Origem: Emily | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - System.Xml.XmlElement', 'income', 69600.00, 'Recebimentos', '2026-01-08', NULL, 'Origem: System.Xml.XmlElement | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Comissao - Celso - Vila Serena', 'income', 69000.00, 'Recebimentos', '2026-01-07', NULL, 'Origem: Celso - Vila Serena | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Carine', 'income', 3000.00, 'Recebimentos', '2026-01-03', NULL, 'Origem: Carine | Mes: jan | Status compensacao: 1', NOW(), NOW()),
('Campanha - Clarus', 'income', 5000.00, 'Recebimentos', '2026-02-25', NULL, 'Origem: Clarus | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Campanha - Wert', 'income', 9850.00, 'Recebimentos', '2026-02-24', NULL, 'Origem: Wert | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Comissao - Brava Luna', 'income', 73993.20, 'Recebimentos', '2026-02-24', NULL, 'Origem: Brava Luna | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Beitiner', 'income', 3000.00, 'Recebimentos', '2026-02-20', NULL, 'Origem: Beitiner | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mobilia - Quanta - moveis', 'income', 20000.00, 'Recebimentos', '2026-02-20', NULL, 'Origem: Quanta - moveis | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Comissao - Phacz Costao', 'income', 52000.00, 'Recebimentos', '2026-02-18', NULL, 'Origem: Phacz Costao | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Reginaldo', 'income', 3000.00, 'Recebimentos', '2026-02-10', NULL, 'Origem: Reginaldo | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Emily', 'income', 3000.00, 'Recebimentos', '2026-02-10', NULL, 'Origem: Emily | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Monica', 'income', 3000.00, 'Recebimentos', '2026-02-10', NULL, 'Origem: Monica | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Drieli', 'income', 3000.00, 'Recebimentos', '2026-02-10', NULL, 'Origem: Drieli | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Carine', 'income', 3000.00, 'Recebimentos', '2026-02-10', NULL, 'Origem: Carine | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Comissao - Luciano Cogo', 'income', 21240.00, 'Recebimentos', '2026-02-06', NULL, 'Origem: Luciano Cogo | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Campanha - Diamond', 'income', 4925.00, 'Recebimentos', '2026-02-02', NULL, 'Origem: Diamond | Mes: fev | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - emily', 'income', 3000.00, 'Recebimentos', '2026-03-17', NULL, 'Origem: emily | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Matheus', 'income', 3000.00, 'Recebimentos', '2026-03-16', NULL, 'Origem: Matheus | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Campanha - Incorpora', 'income', 5000.00, 'Recebimentos', '2026-03-16', NULL, 'Origem: Incorpora | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Comissao - Fernandes Viva', 'income', 30000.00, 'Recebimentos', '2026-03-12', NULL, 'Origem: Fernandes Viva | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Evento - Sergio langer', 'income', 26478.57, 'Recebimentos', '2026-03-13', NULL, 'Origem: Sergio langer | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Campanha - Gard', 'income', 4383.25, 'Recebimentos', '2026-03-12', NULL, 'Origem: Gard | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Campanha - Gard', 'income', 2191.00, 'Recebimentos', '2026-03-12', NULL, 'Origem: Gard | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Campanha - gard', 'income', 2191.00, 'Recebimentos', '2026-03-12', NULL, 'Origem: gard | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Monica', 'income', 3000.00, 'Recebimentos', '2026-03-11', NULL, 'Origem: Monica | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Comissao - bravissima', 'income', 272707.89, 'Recebimentos', '2026-03-06', NULL, 'Origem: bravissima | Mes: mar | Parcela: 46179.0 | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Reginaldo', 'income', 3000.00, 'Recebimentos', '2026-03-11', NULL, 'Origem: Reginaldo | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Mensalidade - Drieli', 'income', 3000.00, 'Recebimentos', '2026-03-11', NULL, 'Origem: Drieli | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Recebimento - Empreendimento rua 109', 'income', 8027.75, 'Recebimentos', '2026-03-06', NULL, 'Origem: Empreendimento rua 109 | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Recebimento - Mauro Bernardes - matheus ver Moov NF', 'income', 10500.00, 'Recebimentos', '2026-03-02', NULL, 'Origem: Mauro Bernardes - matheus ver Moov NF | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG North', 'income', 9850.00, 'Recebimentos', '2026-03-02', NULL, 'Origem: FG North | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG Garden', 'income', 6658.50, 'Recebimentos', '2026-03-02', NULL, 'Origem: FG Garden | Mes: mar | Status compensacao: 1', NOW(), NOW()),
('Comissao - Detalhe Empreendimentos', 'income', 105000.00, 'Recebimentos', '2026-05-24', NULL, 'Origem: Detalhe Empreendimentos | Mes: mai | Status compensacao: 0', NOW(), NOW()),
('Comissao - Senna', 'income', 48712.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Senna | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Comissao - Senna', 'income', 17192.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Senna | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG North', 'income', 9850.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: FG North | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Comissao - FG Garden', 'income', 6658.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: FG Garden | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Campanha - Vokkan Evento', 'income', 9850.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Vokkan Evento | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Campanha - Clarus', 'income', 4950.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Clarus | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Recebimento - Quanta - moveis', 'income', 20000.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Quanta - moveis | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Campanha - Quanta', 'income', 4950.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: Quanta | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Campanha - BGM', 'income', 5000.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: BGM | Mes: abr | Status compensacao: 1', NOW(), NOW()),
('Campanha - CLH', 'income', 5000.00, 'Recebimentos', '2026-03-25', NULL, 'Origem: CLH | Mes: abr | Status compensacao: 1', NOW(), NOW())
ON CONFLICT (description, entry_type, amount, entry_date) DO NOTHING;

COMMIT;
