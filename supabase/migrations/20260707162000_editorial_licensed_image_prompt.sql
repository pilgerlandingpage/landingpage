-- Acrescenta regras de curadoria visual licenciada aos prompts editoriais
-- sem sobrescrever personalizacoes feitas na Sala de Manutencao.

INSERT INTO public.app_config (key, value, description)
VALUES (
  'blog_intelligence_system_prompt',
  $prompt$IMAGENS EDITORIAIS LICENCIADAS - ACERVO, GOOGLE E R2
- Antes de sugerir imagem, defina o intento visual: cidade, bairro, praia, skyline, arquitetura, tipologia de imovel, contexto editorial e risco de uso indevido.
- Priorize imagens reais do acervo Pilger/R2 quando forem diretamente aderentes ao tema.
- Quando faltar acervo aderente, gere consultas especificas para Google Imagens licenciadas/Creative Commons, Wikimedia Commons e fontes verificaveis. Evite termos genericos como mansao de luxo, sala moderna, praia aleatoria, Dubai ou Miami.
- Pexels e Pixabay devem ser fallback, nao a primeira escolha, e so devem ser sugeridos quando a imagem for coerente com o mercado local e nao enganosa.
- Nao sugira imagem sem contexto de licenca. Se a imagem exigir credito, registre autor/fonte/licenca no plano visual.
$prompt$,
  'Bloco de curadoria visual licenciada para o agente de Blog.'
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
    WHEN public.app_config.value IS NULL OR btrim(public.app_config.value) = ''
      THEN EXCLUDED.value
    WHEN public.app_config.value NOT LIKE '%IMAGENS EDITORIAIS LICENCIADAS - ACERVO, GOOGLE E R2%'
      THEN public.app_config.value || E'\n\n' || EXCLUDED.value
    ELSE public.app_config.value
  END,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.app_config (key, value, description)
VALUES (
  'news_intelligence_system_prompt',
  $prompt$IMAGENS EDITORIAIS LICENCIADAS - ACERVO, GOOGLE E R2
- Antes de sugerir imagem, defina o intento visual: fato, cidade, bairro, orgao/obra quando houver, contexto urbano, impacto imobiliario e risco de a imagem parecer registro factual indevido.
- Priorize imagens reais do acervo Pilger/R2 apenas quando forem diretamente aderentes e nao criarem confusao factual.
- Quando faltar acervo aderente, gere consultas especificas para Google Imagens licenciadas/Creative Commons, Wikimedia Commons e fontes verificaveis. Prefira imagens contextuais da cidade/regiao em vez de foto generica de predio ou praia.
- Pexels e Pixabay devem ser fallback, nao a primeira escolha, e so devem ser sugeridos quando a imagem for ilustrativa, coerente e nao enganosa.
- Nao sugira imagem sem contexto de licenca. Se a imagem exigir credito, registre autor/fonte/licenca no plano visual.
$prompt$,
  'Bloco de curadoria visual licenciada para o agente de Noticias.'
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
    WHEN public.app_config.value IS NULL OR btrim(public.app_config.value) = ''
      THEN EXCLUDED.value
    WHEN public.app_config.value NOT LIKE '%IMAGENS EDITORIAIS LICENCIADAS - ACERVO, GOOGLE E R2%'
      THEN public.app_config.value || E'\n\n' || EXCLUDED.value
    ELSE public.app_config.value
  END,
  description = EXCLUDED.description,
  updated_at = now();
