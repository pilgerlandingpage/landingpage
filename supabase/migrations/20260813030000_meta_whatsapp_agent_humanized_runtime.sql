-- Humanized runtime controls for Agente Guilherme on the official Meta WhatsApp channel.
-- Credentials stay in maintenance; these knobs belong to the Agent Office behavior layer.

INSERT INTO public.app_config(key, value, description) VALUES
  (
    'meta_whatsapp_agent_humanize_enabled',
    'true',
    'Agente Guilherme: aplica leitura, pausa curta e ritmo humano antes de responder.'
  ),
  (
    'meta_whatsapp_agent_typing_indicator_enabled',
    'true',
    'Agente Guilherme: marca mensagens recebidas como lidas e solicita indicador de digitacao na Meta Cloud API.'
  ),
  (
    'meta_whatsapp_agent_split_messages',
    'true',
    'Agente Guilherme: divide respostas longas em mensagens menores no WhatsApp oficial.'
  ),
  (
    'meta_whatsapp_agent_response_delay_min_ms',
    '900',
    'Agente Guilherme: pausa minima antes da primeira resposta automatica.'
  ),
  (
    'meta_whatsapp_agent_response_delay_max_ms',
    '4200',
    'Agente Guilherme: pausa maxima antes da primeira resposta automatica.'
  ),
  (
    'meta_whatsapp_agent_typing_ms_per_char',
    '18',
    'Agente Guilherme: ritmo proporcional ao tamanho da resposta.'
  ),
  (
    'meta_whatsapp_agent_chunk_delay_min_ms',
    '700',
    'Agente Guilherme: pausa minima entre partes de uma resposta dividida.'
  ),
  (
    'meta_whatsapp_agent_chunk_delay_max_ms',
    '2200',
    'Agente Guilherme: pausa maxima entre partes de uma resposta dividida.'
  ),
  (
    'meta_whatsapp_agent_audio_enabled',
    'false',
    'Agente Guilherme: permite resposta em audio quando o modo pedir audio e houver TTS configurado.'
  ),
  (
    'meta_whatsapp_agent_response_mode',
    'text',
    'Agente Guilherme: modo de resposta text, audio ou mirror.'
  )
ON CONFLICT (key) DO NOTHING;
