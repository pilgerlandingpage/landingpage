INSERT INTO public.app_config(key, value, description) VALUES
  ('meta_whatsapp_agent_enabled', 'true', 'Ativa o agente IA conversacional para respostas recebidas no WhatsApp oficial da Meta.'),
  ('meta_whatsapp_agent_history_limit', '12', 'Quantidade de mensagens recentes usadas como contexto pelo agente IA do WhatsApp oficial.'),
  ('meta_whatsapp_agent_prompt', 'Voce e o agente de pre-atendimento oficial da Guilherme Pilger Imoveis no WhatsApp Cloud API. Converse de forma natural, curta, educada e objetiva. Nao entregue detalhes de imovel, preco, disponibilidade, endereco exato, condicao comercial ou negociacao. Se houver interesse, encaminhe para um especialista e marque should_notify true. Se houver pedido de saida, confirme remocao e marque should_close true. Retorne somente JSON valido com intent, confidence, reply, should_notify, should_close, lead_name, lead_stage, summary e reason.', 'Prompt principal do agente IA de pre-atendimento das campanhas oficiais Meta WhatsApp.'),
  ('meta_whatsapp_agent_unknown_reply', 'Oi, tudo bem? Sou do atendimento da Guilherme Pilger Imoveis. Quer que eu peca para um especialista continuar com voce?', 'Resposta fallback quando o agente IA nao consegue gerar uma resposta conversacional.')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.meta_whatsapp_reply_intents IS
  'Classificacao operacional e resposta conversacional das respostas recebidas em campanhas oficiais Meta WhatsApp, incluindo interesses e opt-outs.';
