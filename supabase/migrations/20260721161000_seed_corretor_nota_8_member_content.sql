WITH product AS (
  SELECT id
  FROM public.commerce_products
  WHERE slug = 'corretor-nota-8'
  LIMIT 1
),
module_foundation AS (
  INSERT INTO public.commerce_product_contents (
    product_id,
    content_type,
    title,
    description,
    body,
    position,
    is_preview,
    is_active,
    metadata
  )
  SELECT
    product.id,
    'module',
    'Fundamentos do Corretor Nota 8',
    'O ponto de partida para organizar postura, posicionamento e método comercial.',
    'Comece por aqui. Este módulo organiza a visão central do Corretor Nota 8 antes de entrar nas cinco dimensões práticas.',
    10,
    false,
    true,
    '{"seeded_by":"20260721161000_seed_corretor_nota_8_member_content"}'::jsonb
  FROM product
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.commerce_product_contents existing
    WHERE existing.product_id = product.id
      AND existing.content_type = 'module'
      AND existing.title = 'Fundamentos do Corretor Nota 8'
  )
  RETURNING id, product_id
),
module_foundation_ref AS (
  SELECT id, product_id FROM module_foundation
  UNION ALL
  SELECT existing.id, existing.product_id
  FROM public.commerce_product_contents existing
  JOIN product ON product.id = existing.product_id
  WHERE existing.content_type = 'module'
    AND existing.title = 'Fundamentos do Corretor Nota 8'
  LIMIT 1
),
module_dimensions AS (
  INSERT INTO public.commerce_product_contents (
    product_id,
    content_type,
    title,
    description,
    body,
    position,
    is_preview,
    is_active,
    metadata
  )
  SELECT
    product.id,
    'module',
    'As 5 dimensões da postura comercial',
    'Direção, execução, posicionamento, relacionamento e disciplina aplicados ao mercado imobiliário.',
    'Use este módulo como roteiro prático para transformar a leitura em rotina comercial.',
    20,
    false,
    true,
    '{"seeded_by":"20260721161000_seed_corretor_nota_8_member_content"}'::jsonb
  FROM product
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.commerce_product_contents existing
    WHERE existing.product_id = product.id
      AND existing.content_type = 'module'
      AND existing.title = 'As 5 dimensões da postura comercial'
  )
  RETURNING id, product_id
),
module_dimensions_ref AS (
  SELECT id, product_id FROM module_dimensions
  UNION ALL
  SELECT existing.id, existing.product_id
  FROM public.commerce_product_contents existing
  JOIN product ON product.id = existing.product_id
  WHERE existing.content_type = 'module'
    AND existing.title = 'As 5 dimensões da postura comercial'
  LIMIT 1
)
INSERT INTO public.commerce_product_contents (
  product_id,
  parent_id,
  content_type,
  title,
  description,
  body,
  asset_url,
  duration_seconds,
  position,
  is_preview,
  is_active,
  metadata
)
SELECT
  item.product_id,
  item.parent_id,
  item.content_type,
  item.title,
  item.description,
  item.body,
  item.asset_url,
  item.duration_seconds,
  item.position,
  item.is_preview,
  true,
  '{"seeded_by":"20260721161000_seed_corretor_nota_8_member_content"}'::jsonb
FROM (
  SELECT
    module_foundation_ref.product_id,
    module_foundation_ref.id AS parent_id,
    'ebook' AS content_type,
    'Livro online Corretor Nota 8' AS title,
    'Material principal da compra para leitura dentro da area de membros.' AS description,
    'Bem-vindo ao Corretor Nota 8. Este livro foi organizado para leitura online dentro da area de membros, sem entrega de PDF. Use os modulos seguintes para transformar os conceitos em rotina comercial: direcao, execucao, posicionamento, relacionamento e disciplina.' AS body,
    NULL::text AS asset_url,
    NULL::integer AS duration_seconds,
    10 AS position,
    false AS is_preview
  FROM module_foundation_ref

  UNION ALL

  SELECT
    module_foundation_ref.product_id,
    module_foundation_ref.id,
    'lesson',
    'Como usar este método na rotina',
    'Orientação inicial para transformar a leitura em ação comercial.',
    'Leia com um bloco de notas aberto. A proposta não é decorar frases, mas ajustar critério, postura, relacionamento e execução comercial.',
    NULL::text,
    8 * 60,
    20,
    false
  FROM module_foundation_ref

  UNION ALL

  SELECT
    module_dimensions_ref.product_id,
    module_dimensions_ref.id,
    'lesson',
    'Direção: escolha de mercado e clareza de jogo',
    'Defina onde você quer jogar antes de tentar falar com todo mundo.',
    'A direção ajuda o corretor a escolher nicho, público e tipo de imóvel com mais critério. Sem direção, a rotina vira reação.',
    NULL::text,
    10 * 60,
    10,
    false
  FROM module_dimensions_ref

  UNION ALL

  SELECT
    module_dimensions_ref.product_id,
    module_dimensions_ref.id,
    'lesson',
    'Execução: disciplina para vender alto padrão',
    'Transforme método em cadência comercial.',
    'Execução é a ponte entre posicionamento bonito e resultado real. Use esta aula para revisar agenda, follow-up, abordagem e consistência.',
    NULL::text,
    12 * 60,
    20,
    false
  FROM module_dimensions_ref
) item
WHERE NOT EXISTS (
  SELECT 1
  FROM public.commerce_product_contents existing
  WHERE existing.product_id = item.product_id
    AND existing.title = item.title
    AND existing.content_type = item.content_type
);
