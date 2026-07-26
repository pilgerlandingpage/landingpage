-- The Perfil do Corretor Ideal campaign no longer uses coupons.
-- Leads validated by WhatsApp receive a direct promotional checkout offer instead.
DO $$
DECLARE
  cn8_product_id UUID;
  cn8_landing_page_id UUID;
BEGIN
  SELECT id INTO cn8_product_id
  FROM public.commerce_products
  WHERE slug = 'corretor-nota-8'
  LIMIT 1;

  SELECT id INTO cn8_landing_page_id
  FROM public.landing_pages
  WHERE slug = 'corretor-nota-8'
  LIMIT 1;

  IF cn8_product_id IS NOT NULL THEN
    INSERT INTO public.commerce_offers (
      product_id,
      landing_page_id,
      slug,
      name,
      description,
      status,
      price_cents,
      currency,
      checkout_path,
      payment_methods,
      metadata
    )
    VALUES (
      cn8_product_id,
      cn8_landing_page_id,
      'corretor-nota-8-perfil-corretor-ideal',
      'Oferta Perfil do Corretor Ideal',
      'Oferta especial do Corretor Nota 8 liberada apos voto validado no Perfil do Corretor Ideal.',
      'active',
      4850,
      'BRL',
      '/checkout/corretor-nota-8-perfil-corretor-ideal',
      ARRAY['pix']::TEXT[],
      jsonb_build_object(
        'source', 'perfil_corretor_ideal_vote_validated',
        'original_price_cents', 9700,
        'promotional_price_cents', 4850,
        'discount_percent', 50,
        'seeded_by', '20260721190000_retire_self_assessment_coupons_promotional_offer'
      )
    )
    ON CONFLICT (slug) DO UPDATE SET
      product_id = EXCLUDED.product_id,
      landing_page_id = EXCLUDED.landing_page_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      price_cents = EXCLUDED.price_cents,
      currency = EXCLUDED.currency,
      checkout_path = EXCLUDED.checkout_path,
      payment_methods = EXCLUDED.payment_methods,
      metadata = public.commerce_offers.metadata || EXCLUDED.metadata,
      updated_at = now();
  END IF;

  UPDATE public.commerce_coupons
  SET
    status = 'archived',
    ends_at = COALESCE(ends_at, now()),
    metadata = metadata || jsonb_build_object(
      'retired_by', '20260721190000_retire_self_assessment_coupons_promotional_offer',
      'retire_reason', 'campaign_uses_direct_promotional_offer'
    ),
    updated_at = now()
  WHERE lower(code) IN ('pilger30', 'pilger50');
END $$;
