CREATE TABLE IF NOT EXISTS public.meta_whatsapp_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  waba_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta_cloud_api',
  local_status TEXT NOT NULL DEFAULT 'active'
    CHECK (local_status IN ('active', 'paused', 'disabled')),
  meta_status TEXT,
  quality_rating TEXT,
  messaging_limit_tier TEXT,
  account_mode TEXT,
  use_case TEXT NOT NULL DEFAULT 'campaign'
    CHECK (use_case IN ('campaign', 'editorial', 'followup', 'global')),
  send_rate_per_minute INTEGER NOT NULL DEFAULT 40
    CHECK (send_rate_per_minute >= 1 AND send_rate_per_minute <= 1000),
  daily_limit INTEGER NOT NULL DEFAULT 1000
    CHECK (daily_limit >= 1 AND daily_limit <= 1000000),
  daily_sent_count INTEGER NOT NULL DEFAULT 0
    CHECK (daily_sent_count >= 0),
  daily_limit_resets_at TIMESTAMPTZ,
  weight INTEGER NOT NULL DEFAULT 1
    CHECK (weight >= 1 AND weight <= 100),
  last_health_check_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_senders_pool
  ON public.meta_whatsapp_senders(local_status, use_case, weight DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_senders_waba
  ON public.meta_whatsapp_senders(waba_id, phone_number_id);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id TEXT NOT NULL,
  template_external_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  status TEXT NOT NULL DEFAULT 'unknown',
  quality_score TEXT,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameter_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (waba_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_templates_status
  ON public.meta_whatsapp_templates(waba_id, status, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'admin',
  campaign_type TEXT NOT NULL DEFAULT 'marketing'
    CHECK (campaign_type IN ('marketing', 'editorial', 'followup', 'utility', 'test')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'preparing', 'queued', 'sending', 'paused', 'completed', 'cancelled', 'failed')),
  template_id UUID REFERENCES public.meta_whatsapp_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  sender_routing_mode TEXT NOT NULL DEFAULT 'weighted_pool'
    CHECK (sender_routing_mode IN ('single', 'round_robin', 'weighted_pool')),
  default_sender_id UUID REFERENCES public.meta_whatsapp_senders(id) ON DELETE SET NULL,
  audience_source TEXT NOT NULL DEFAULT 'custom_paste'
    CHECK (audience_source IN ('custom_paste', 'lead_filter', 'commerce_customers', 'education_leads', 'editorial_distribution')),
  audience_query JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  total_queued INTEGER NOT NULL DEFAULT 0 CHECK (total_queued >= 0),
  total_sent INTEGER NOT NULL DEFAULT 0 CHECK (total_sent >= 0),
  total_delivered INTEGER NOT NULL DEFAULT 0 CHECK (total_delivered >= 0),
  total_read INTEGER NOT NULL DEFAULT 0 CHECK (total_read >= 0),
  total_failed INTEGER NOT NULL DEFAULT 0 CHECK (total_failed >= 0),
  total_skipped INTEGER NOT NULL DEFAULT 0 CHECK (total_skipped >= 0),
  total_cost_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaigns_status
  ON public.meta_whatsapp_campaigns(status, scheduled_for, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaigns_type
  ON public.meta_whatsapp_campaigns(campaign_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.meta_whatsapp_senders(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.meta_whatsapp_templates(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  education_lead_id UUID REFERENCES public.education_leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  opt_in_source TEXT,
  opt_in_at TIMESTAMPTZ,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped', 'opted_out')),
  error_code TEXT,
  error_message TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cost_category TEXT,
  cost_amount NUMERIC(12,4),
  currency TEXT NOT NULL DEFAULT 'BRL',
  template_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_phone)
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaign_recipients_status
  ON public.meta_whatsapp_campaign_recipients(status, scheduled_for, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaign_recipients_campaign
  ON public.meta_whatsapp_campaign_recipients(campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaign_recipients_message
  ON public.meta_whatsapp_campaign_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_campaign_recipients_phone
  ON public.meta_whatsapp_campaign_recipients(recipient_phone, created_at DESC);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id TEXT,
  recipient_id UUID REFERENCES public.meta_whatsapp_campaign_recipients(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.meta_whatsapp_senders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_status TEXT,
  recipient_phone TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_events_message
  ON public.meta_whatsapp_events(provider_message_id, received_at DESC)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_events_campaign
  ON public.meta_whatsapp_events(campaign_id, received_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'meta_whatsapp',
  reason TEXT,
  campaign_id UUID REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.meta_whatsapp_campaign_recipients(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_opt_outs_requested
  ON public.meta_whatsapp_opt_outs(requested_at DESC);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_sender_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.meta_whatsapp_senders(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  delivered_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  cost_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_sender_daily_usage_date
  ON public.meta_whatsapp_sender_daily_usage(usage_date DESC, sent_count DESC);

CREATE OR REPLACE FUNCTION public.update_meta_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meta_whatsapp_senders_updated_at ON public.meta_whatsapp_senders;
CREATE TRIGGER meta_whatsapp_senders_updated_at
BEFORE UPDATE ON public.meta_whatsapp_senders
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_templates_updated_at ON public.meta_whatsapp_templates;
CREATE TRIGGER meta_whatsapp_templates_updated_at
BEFORE UPDATE ON public.meta_whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_campaigns_updated_at ON public.meta_whatsapp_campaigns;
CREATE TRIGGER meta_whatsapp_campaigns_updated_at
BEFORE UPDATE ON public.meta_whatsapp_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_campaign_recipients_updated_at ON public.meta_whatsapp_campaign_recipients;
CREATE TRIGGER meta_whatsapp_campaign_recipients_updated_at
BEFORE UPDATE ON public.meta_whatsapp_campaign_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_sender_daily_usage_updated_at ON public.meta_whatsapp_sender_daily_usage;
CREATE TRIGGER meta_whatsapp_sender_daily_usage_updated_at
BEFORE UPDATE ON public.meta_whatsapp_sender_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'meta_whatsapp_senders',
    'meta_whatsapp_templates',
    'meta_whatsapp_campaigns',
    'meta_whatsapp_campaign_recipients',
    'meta_whatsapp_events',
    'meta_whatsapp_opt_outs',
    'meta_whatsapp_sender_daily_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'service_role_full_access_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        'service_role_full_access_' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.app_config (key, value, description, updated_at)
VALUES
  ('meta_whatsapp_enabled', 'false', 'Ativa o envio em massa pela API oficial Meta WhatsApp Cloud API.', now()),
  ('meta_whatsapp_business_account_id', '', 'WhatsApp Business Account ID (WABA ID) usado para templates e numeros oficiais.', now()),
  ('meta_whatsapp_default_phone_number_id', '', 'Phone Number ID padrao para testes e disparos oficiais.', now()),
  ('meta_whatsapp_access_token', '', 'Token de usuario de sistema com whatsapp_business_messaging e whatsapp_business_management.', now()),
  ('meta_whatsapp_webhook_verify_token', 'pilger-meta-whatsapp-webhook', 'Token de verificacao do webhook WhatsApp oficial.', now()),
  ('meta_whatsapp_app_secret', '', 'App Secret usado para validar assinaturas de webhook Meta WhatsApp.', now()),
  ('meta_whatsapp_api_version', 'v21.0', 'Versao da Graph API usada no WhatsApp Cloud API.', now()),
  ('meta_whatsapp_default_language', 'pt_BR', 'Idioma padrao dos templates oficiais.', now()),
  ('meta_whatsapp_support_redirect_phone', '', 'Numero ConnectyHub/atendimento para CTA e redirecionamento de respostas.', now()),
  ('meta_whatsapp_send_rate_per_minute', '40', 'Limite interno de envios por minuto por numero oficial.', now()),
  ('meta_whatsapp_daily_limit_per_number', '1000', 'Limite interno diario por numero oficial.', now())
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.meta_whatsapp_senders IS
  'Numeros oficiais Meta WhatsApp Cloud API usados para campanhas, editoriais e follow-ups autorizados.';

COMMENT ON TABLE public.meta_whatsapp_campaigns IS
  'Campanhas disparadas via API oficial Meta WhatsApp. Atendimento com IA permanece na ConnectyHub.';

COMMENT ON TABLE public.meta_whatsapp_campaign_recipients IS
  'Fila e historico por destinatario das campanhas oficiais Meta WhatsApp.';
