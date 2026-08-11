-- Integracao de vendas do commerce com lancamentos financeiros.
-- Cada pagamento Mercado Pago aprovado deve gerar no maximo uma receita em finance_entries.

BEGIN;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_entries_commerce_sales_reference
ON public.finance_entries (source_module, external_reference)
WHERE source_module = 'commerce_sales'
  AND external_reference IS NOT NULL;

INSERT INTO public.finance_categories (name, entry_type, is_active)
VALUES ('Produtos Digitais', 'income', true)
ON CONFLICT (name) DO UPDATE SET
  entry_type = CASE
    WHEN public.finance_categories.entry_type IN ('income', 'both') THEN public.finance_categories.entry_type
    ELSE 'both'
  END,
  is_active = true,
  updated_at = now();

WITH category AS (
  SELECT id
  FROM public.finance_categories
  WHERE name = 'Produtos Digitais'
  LIMIT 1
)
INSERT INTO public.finance_subcategories (category_id, name, is_active)
SELECT id, 'Vendas Online', true
FROM category
ON CONFLICT (category_id, name) DO UPDATE SET
  is_active = true,
  updated_at = now();

INSERT INTO public.finance_payment_methods (name, is_active)
VALUES ('Mercado Pago Pix', true)
ON CONFLICT (name) DO UPDATE SET
  is_active = true,
  updated_at = now();

INSERT INTO public.finance_cost_centers (name, code, is_active)
VALUES ('Produtos Digitais', 'DIGITAL', true)
ON CONFLICT (name) DO UPDATE SET
  code = COALESCE(public.finance_cost_centers.code, EXCLUDED.code),
  is_active = true,
  updated_at = now();

COMMIT;
