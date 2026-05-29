-- Hardening do ecossistema de agentes WhatsApp.
-- Mantem compatibilidade com ambientes onde migrations antigas nao foram aplicadas.

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT,
  event_type TEXT,
  message_type TEXT,
  action TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  from_phone TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sender_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_audit_created_at
  ON public.whatsapp_webhook_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_audit_instance
  ON public.whatsapp_webhook_audit_logs (instance_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_audit_phone
  ON public.whatsapp_webhook_audit_logs (from_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_audit_lead
  ON public.whatsapp_webhook_audit_logs (lead_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_audit_action
  ON public.whatsapp_webhook_audit_logs (action);

ALTER TABLE public.whatsapp_webhook_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_webhook_audit_logs'
      AND policyname = 'service_role_full_access_whatsapp_webhook_audit_logs'
  ) THEN
    CREATE POLICY "service_role_full_access_whatsapp_webhook_audit_logs"
      ON public.whatsapp_webhook_audit_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS summary_to_phone TEXT;

ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS handoff_prompt TEXT;

INSERT INTO public.app_config (key, value, updated_at)
VALUES
  ('whatsapp_legacy_property_catalog_enabled', 'false', now()),
  ('agent_transfer_instance_ids', '[]', now()),
  ('agent_transfer_mode', 'round_robin', now())
ON CONFLICT (key) DO NOTHING;
