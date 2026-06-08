-- ============================================================
-- finance_entities: entidades da empresa (PF e PJ)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'pj' CHECK (entity_type IN ('pf', 'pj')),
    cpf_cnpj TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_entities_active ON public.finance_entities (is_active);

-- Garante que só uma entidade seja default por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_entities_default
    ON public.finance_entities (is_default)
    WHERE is_default = true;

-- Seeds: duas entidades padrão (admin preenche os dados reais)
INSERT INTO public.finance_entities (name, entity_type, description, is_default)
VALUES
    ('Guilherme Pilger', 'pf', 'Pessoa física — CPF do titular', true),
    ('Imobiliária Guilherme Pilger', 'pj', 'Pessoa jurídica — CNPJ da imobiliária', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- finance_counterparties: adicionar CPF/CNPJ, email, telefone
-- ============================================================
ALTER TABLE public.finance_counterparties
    ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================
-- finance_entries: adicionar entity_id
-- ============================================================
ALTER TABLE public.finance_entries
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.finance_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_entity_id ON public.finance_entries (entity_id);

-- ============================================================
-- finance_payables: adicionar entity_id
-- ============================================================
ALTER TABLE public.finance_payables
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.finance_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_payables_entity_id ON public.finance_payables (entity_id);

-- ============================================================
-- finance_receivables: adicionar entity_id
-- ============================================================
ALTER TABLE public.finance_receivables
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.finance_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_receivables_entity_id ON public.finance_receivables (entity_id);

-- ============================================================
-- finance_commissions: adicionar entity_id
-- ============================================================
ALTER TABLE public.finance_commissions
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.finance_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_commissions_entity_id ON public.finance_commissions (entity_id);

-- ============================================================
-- finance_alert_logs: registro de alertas enviados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL DEFAULT 'due_date',
    entity_id UUID REFERENCES public.finance_entities(id) ON DELETE SET NULL,
    payable_ids JSONB,
    recipient_email TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    items_count INTEGER DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_finance_alert_logs_sent_at ON public.finance_alert_logs (sent_at DESC);
