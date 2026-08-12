INSERT INTO public.app_config(key, value, description)
VALUES (
  'meta_whatsapp_app_id',
  '',
  'App ID dedicado para WhatsApp Cloud API. Quando vazio, usa o meta_app_id geral.'
)
ON CONFLICT (key) DO NOTHING;
