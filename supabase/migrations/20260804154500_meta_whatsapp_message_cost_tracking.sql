-- Coleta de custo por mensagem Meta WhatsApp a partir dos webhooks de status.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_pricing_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL,
  country_calling_code TEXT,
  pricing_category TEXT NOT NULL CHECK (pricing_category IN ('marketing', 'utility', 'authentication', 'service')),
  currency TEXT NOT NULL DEFAULT 'BRL',
  amount_per_message NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (amount_per_message >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'manual_rate_card',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market_code, pricing_category, currency, effective_from)
);

ALTER TABLE public.meta_whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS pricing_type TEXT,
  ADD COLUMN IF NOT EXISTS pricing_model TEXT,
  ADD COLUMN IF NOT EXISTS pricing_billable BOOLEAN,
  ADD COLUMN IF NOT EXISTS cost_market TEXT,
  ADD COLUMN IF NOT EXISTS cost_status TEXT;

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_recipients_cost_status
  ON public.meta_whatsapp_campaign_recipients(cost_status, cost_market, cost_category);

-- Service fica sem custo enquanto a regra atual da Meta mantiver service gratuito.
INSERT INTO public.meta_whatsapp_pricing_rates (
  market_code,
  country_calling_code,
  pricing_category,
  currency,
  amount_per_message,
  effective_from,
  source,
  notes
) VALUES (
  'BR',
  '55',
  'service',
  'BRL',
  0,
  '2026-06-01',
  'meta_platform_pricing',
  'Mensagens de atendimento/service atualmente gratuitas; manter revisado quando a Meta alterar precificacao.'
)
ON CONFLICT (market_code, pricing_category, currency, effective_from) DO UPDATE SET
  amount_per_message = EXCLUDED.amount_per_message,
  is_active = true,
  updated_at = now();

COMMIT;
