-- Modulo Financeiro (ERP)
-- Cria tabela de lancamentos financeiros e permissao RBAC

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

CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON public.finance_entries(entry_date DESC);
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

