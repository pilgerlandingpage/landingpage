-- Garante os cadastros minimos usados pelo lancamento automatico de trafego pago.

BEGIN;

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
SELECT id, name, true
FROM category
CROSS JOIN (VALUES ('Meta Ads'), ('Google Ads')) AS subcategories(name)
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

UPDATE public.finance_entries fe
SET
  category = 'Marketing',
  payment_method = 'Cartao',
  cost_center_id = cc.id,
  updated_at = now()
FROM public.finance_cost_centers cc
WHERE cc.name = 'Marketing'
  AND fe.source_module IN ('paid_ads', 'paid_ads_monthly');

COMMIT;
