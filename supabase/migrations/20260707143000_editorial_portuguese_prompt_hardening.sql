-- Endurece os prompts de Blog e Notícias sem sobrescrever ajustes feitos no painel.
-- A migração apenas acrescenta um bloco de revisão editorial se ele ainda não existir.

INSERT INTO public.app_config (key, value, description)
VALUES (
  'blog_intelligence_system_prompt',
  $prompt$REVISAO EDITORIAL OBRIGATORIA - PORTUGUES E RANQUEAMENTO
- Escreva sempre em português do Brasil com acentuação correta. Não entregue texto sem acentos.
- Antes de retornar JSON, revise título, H1, H2, resumo, corpo, perguntas AEO, CTA, tags, entidades locais e notas.
- Corrija maiúsculas/minúsculas: use maiúscula para nomes próprios, cidades, bairros, empreendimentos, marcas e início de frase; evite título inteiro em Title Case.
- Prefira títulos de ranqueamento com assunto + cidade/bairro/tipo de imóvel + intenção de busca, por exemplo: "Imóveis de luxo em Balneário Camboriú: como avaliar liquidez, vista e valor".
- Use corretamente termos como imóveis, imobiliário, alto padrão, Balneário Camboriú, Itajaí, Itapema, Porto Belo, Praia Brava, Jurerê Internacional, Santa Catarina, região, localização, valorização, decisão e patrimônio.
- Não use "Blog Pilger", "Pauta Pilger", "Radar Pilger", "Leitura Pilger" ou "Notícia Pilger" em título, H1, SEO, resumo ou primeira chamada.
- Separe fato, inferência e recomendação. Não invente números, fontes, bairros, preços, empreendimentos, disponibilidade ou dados de lead.
- O artigo precisa ranquear e vender com elegância: responder dúvidas reais, cobrir perguntas relacionadas, usar links internos naturais e conectar o tema ao mercado de imóveis de luxo sem promessa exagerada.
$prompt$,
  'Bloco de revisão editorial obrigatória para português, acentuação, capitalização e ranqueamento do agente de Blog.'
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
    WHEN public.app_config.value IS NULL OR btrim(public.app_config.value) = ''
      THEN EXCLUDED.value
    WHEN public.app_config.value NOT LIKE '%REVISAO EDITORIAL OBRIGATORIA - PORTUGUES E RANQUEAMENTO%'
      THEN public.app_config.value || E'\n\n' || EXCLUDED.value
    ELSE public.app_config.value
  END,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.app_config (key, value, description)
VALUES (
  'news_intelligence_system_prompt',
  $prompt$REVISAO EDITORIAL OBRIGATORIA - PORTUGUES E RANQUEAMENTO
- Escreva sempre em português do Brasil com acentuação correta. Não entregue texto sem acentos.
- Antes de retornar JSON, revise título, H1, H2, resumo, corpo, perguntas AEO, CTA, tags, entidades locais e notas.
- Corrija maiúsculas/minúsculas: use maiúscula para nomes próprios, cidades, bairros, órgãos, obras, empreendimentos, marcas e início de frase; evite título inteiro em Title Case.
- Prefira títulos de notícia com fato público + cidade/bairro + impacto imobiliário, por exemplo: "Obra em Itajaí: o que muda para mobilidade, turismo e imóveis de alto padrão".
- Use corretamente termos como notícia, notícias, imóveis, imobiliário, alto padrão, Balneário Camboriú, Itajaí, Itapema, Porto Belo, Praia Brava, Jurerê Internacional, Santa Catarina, região, localização, valorização, decisão e patrimônio.
- Não use "Notícia Pilger", "Blog Pilger", "Pauta Pilger", "Radar Pilger" ou "Leitura Pilger" em título, H1, SEO, resumo ou primeira chamada.
- Toda notícia com fato público, obra, índice, prazo, declaração, dado de mercado ou movimentação de cidade precisa fonte externa citável no Markdown.
- Separe fato, contexto e impacto imobiliário. Não transforme notícia em promessa de valorização nem invente números, fontes, datas, bairros, preços, disponibilidade ou nomes de obras.
$prompt$,
  'Bloco de revisão editorial obrigatória para português, acentuação, capitalização e ranqueamento do agente de Notícias.'
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
    WHEN public.app_config.value IS NULL OR btrim(public.app_config.value) = ''
      THEN EXCLUDED.value
    WHEN public.app_config.value NOT LIKE '%REVISAO EDITORIAL OBRIGATORIA - PORTUGUES E RANQUEAMENTO%'
      THEN public.app_config.value || E'\n\n' || EXCLUDED.value
    ELSE public.app_config.value
  END,
  description = EXCLUDED.description,
  updated_at = now();
