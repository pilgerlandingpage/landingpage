DO $$
DECLARE
  cn8_product_id UUID;
BEGIN
  SELECT id INTO cn8_product_id
  FROM public.commerce_products
  WHERE slug = 'corretor-nota-8'
  LIMIT 1;

  IF cn8_product_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.commerce_coupons WHERE lower(code) = lower('PILGER30')) THEN
    UPDATE public.commerce_coupons
    SET
      description = 'Desconto liberado pela validacao do voto no Perfil do Corretor Ideal.',
      status = 'active',
      discount_type = 'percentage',
      amount_cents = NULL,
      percentage = 30,
      product_ids = ARRAY[cn8_product_id]::UUID[],
      metadata = public.commerce_coupons.metadata || jsonb_build_object(
        'source', 'perfil_corretor_ideal_vote_proof',
        'updated_by_migration', '20260721172000_seed_self_assessment_pilger30_coupon'
      ),
      updated_at = now()
    WHERE lower(code) = lower('PILGER30');
  ELSE
    INSERT INTO public.commerce_coupons (
      code,
      description,
      status,
      discount_type,
      percentage,
      product_ids,
      metadata
    )
    VALUES (
      'PILGER30',
      'Desconto liberado pela validacao do voto no Perfil do Corretor Ideal.',
      'active',
      'percentage',
      30,
      ARRAY[cn8_product_id]::UUID[],
      jsonb_build_object(
        'source', 'perfil_corretor_ideal_vote_proof',
        'seeded_by', '20260721172000_seed_self_assessment_pilger30_coupon'
      )
    );
  END IF;
END $$;
