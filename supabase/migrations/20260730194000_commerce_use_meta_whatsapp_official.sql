INSERT INTO public.app_config (key, value, description, updated_at)
VALUES
  (
    'commerce_whatsapp_outbound_provider',
    'meta_whatsapp',
    'Provedor usado para mensagens WhatsApp comerciais de saida. Use meta_whatsapp para disparos oficiais com modelos aprovados; ConnectyHub fica apenas para atendimento/entrada.',
    now()
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
