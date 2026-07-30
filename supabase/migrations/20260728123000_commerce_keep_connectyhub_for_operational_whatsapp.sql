INSERT INTO public.app_config (key, value, description, updated_at)
VALUES
  (
    'commerce_whatsapp_outbound_provider',
    'connectyhub',
    'Provedor usado para mensagens WhatsApp operacionais/transacionais. Meta WhatsApp fica reservado para campanhas e disparos em massa.',
    now()
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
