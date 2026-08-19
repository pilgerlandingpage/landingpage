INSERT INTO public.app_config (key, value, description, updated_at)
VALUES (
  'meta_whatsapp_waba_accounts',
  '',
  'Lista JSON de contas WhatsApp Business confirmadas para sincronizacao multi-WABA.',
  now()
)
ON CONFLICT (key) DO NOTHING;
