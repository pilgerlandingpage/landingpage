-- Tarifas oficiais em BRL para WhatsApp Business Platform.
-- Fonte: CSV "Cost per message in BRL on the WhatsApp Business Platform, effective July 1, 2026".

BEGIN;

INSERT INTO public.meta_whatsapp_pricing_rates (
  market_code,
  country_calling_code,
  pricing_category,
  currency,
  amount_per_message,
  effective_from,
  source,
  notes
) VALUES
  (
    'BR',
    '55',
    'marketing',
    'BRL',
    0.3217,
    '2026-07-01',
    'meta_rate_card_brl_2026_07_01',
    'Brasil no rate card oficial em BRL da Meta/WhatsApp: Marketing 0.3217 BRL por mensagem entregue.'
  ),
  (
    'BR',
    '55',
    'utility',
    'BRL',
    0.0350,
    '2026-07-01',
    'meta_rate_card_brl_2026_07_01',
    'Brasil no rate card oficial em BRL da Meta/WhatsApp: Utility 0.0350 BRL por mensagem entregue.'
  ),
  (
    'BR',
    '55',
    'authentication',
    'BRL',
    0.0350,
    '2026-07-01',
    'meta_rate_card_brl_2026_07_01',
    'Brasil no rate card oficial em BRL da Meta/WhatsApp: Authentication 0.0350 BRL por mensagem entregue.'
  ),
  (
    'BR',
    '55',
    'service',
    'BRL',
    0,
    '2026-07-01',
    'meta_rate_card_brl_2026_07_01',
    'Brasil no rate card oficial em BRL marca Service como n/a; custo mantido em zero quando o webhook indicar mensagem nao faturavel.'
  )
ON CONFLICT (market_code, pricing_category, currency, effective_from) DO UPDATE SET
  country_calling_code = EXCLUDED.country_calling_code,
  amount_per_message = EXCLUDED.amount_per_message,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  is_active = true,
  updated_at = now();

COMMIT;
