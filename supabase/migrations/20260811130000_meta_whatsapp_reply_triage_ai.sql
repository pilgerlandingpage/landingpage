INSERT INTO public.app_config(key, value, description) VALUES
  (
    'meta_whatsapp_triage_ai_enabled',
    'true',
    'Ativa IA para interpretar contexto das respostas recebidas nas campanhas oficiais Meta WhatsApp.'
  ),
  (
    'meta_whatsapp_triage_ai_min_confidence',
    '70',
    'Confianca minima, de 0 a 100, para aceitar a classificacao da IA na triagem Meta WhatsApp.'
  ),
  (
    'meta_whatsapp_triage_ai_prompt',
    'Voce e um agente de triagem de respostas de campanhas oficiais de WhatsApp da imobiliaria.
Sua tarefa e classificar a intencao do lead sem entregar detalhes do imovel, campanha, preco ou oferta.
Retorne somente JSON valido, sem markdown, neste formato:
{"intent":"interested|opt_out|question|unknown","confidence":0-100,"reason":"motivo curto"}

Regras:
- interested: o lead pede "saiba mais", quer detalhes, pergunta valor, agenda visita, pede atendimento ou demonstra curiosidade positiva.
- opt_out: o lead pede para sair, parar, remover, apagar dados, nao receber mais, ou expressa rejeicao clara.
- question: o lead pergunta sobre origem do contato, privacidade, cadastro ou dados, sem pedir remocao e sem demonstrar interesse.
- unknown: mensagens vagas, saudacoes soltas ou textos sem decisao operacional.
Quando houver interesse misturado com duvida, prefira interested. Quando houver pedido de remocao, sempre prefira opt_out.',
    'Prompt usado pela IA para classificar respostas das campanhas oficiais Meta WhatsApp.'
  )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;
