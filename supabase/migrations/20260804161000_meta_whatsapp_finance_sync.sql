-- Lancamento automatico mensal dos custos de disparos Meta WhatsApp no financeiro.

BEGIN;

ALTER TABLE public.meta_whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS cost_recorded_at TIMESTAMPTZ;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_entries_meta_whatsapp_monthly_reference
ON public.finance_entries (source_module, external_reference)
WHERE source_module = 'meta_whatsapp_messages_monthly'
  AND external_reference IS NOT NULL;

INSERT INTO public.finance_categories (name, entry_type, is_active)
VALUES ('Marketing', 'expense', true)
ON CONFLICT (name) DO UPDATE SET
  entry_type = 'expense',
  is_active = true,
  updated_at = now();

WITH category AS (
  SELECT id
  FROM public.finance_categories
  WHERE name = 'Marketing'
  LIMIT 1
)
INSERT INTO public.finance_subcategories (category_id, name, is_active)
SELECT id, 'Meta WhatsApp', true
FROM category
ON CONFLICT (category_id, name) DO UPDATE SET
  is_active = true,
  updated_at = now();

INSERT INTO public.finance_payment_methods (name, is_active)
VALUES ('Cartao', true)
ON CONFLICT (name) DO UPDATE SET
  is_active = true,
  updated_at = now();

INSERT INTO public.finance_cost_centers (name, code, is_active)
VALUES ('Marketing', 'MKT', true)
ON CONFLICT (name) DO UPDATE SET
  code = COALESCE(public.finance_cost_centers.code, EXCLUDED.code),
  is_active = true,
  updated_at = now();

COMMIT;
