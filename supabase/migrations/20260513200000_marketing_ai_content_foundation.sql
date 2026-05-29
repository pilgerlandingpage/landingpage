INSERT INTO public.app_config (key, value, description)
VALUES
  ('instagram_business_access_token', '', 'Token da Instagram API com permissao de Direct, comentarios e publicacao.'),
  ('instagram_business_account_id', '', 'ID da conta Instagram Business usada pela Instagram API.'),
  ('facebook_page_access_token', '', 'Page access token para Messenger, comentarios e publicacao no Facebook.'),
  ('meta_app_id', '', 'App ID da Meta.'),
  ('meta_app_secret', '', 'App Secret da Meta.'),
  ('meta_webhook_verify_token', 'pilger-meta-webhook', 'Token de verificacao do webhook Meta.'),
  ('meta_social_agent_enabled', 'false', 'Ativa agente de atendimento social.'),
  ('meta_social_agent_autopilot', 'false', 'Permite respostas automaticas do agente social.'),
  ('organic_report_agent_enabled', 'true', 'Ativa agente de relatorios de trafego organico.'),
  ('paid_report_agent_enabled', 'true', 'Ativa agente de relatorios de trafego pago.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marketing_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  asset_url text,
  thumbnail_url text,
  asset_type text NOT NULL DEFAULT 'image' CHECK (asset_type IN ('image', 'video', 'carousel', 'document', 'other')),
  content_type text NOT NULL DEFAULT 'post' CHECK (content_type IN ('post', 'reel', 'story', 'ad', 'short', 'email', 'other')),
  campaign_type text NOT NULL DEFAULT 'organic' CHECK (campaign_type IN ('organic', 'paid', 'both')),
  platform_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  property_id uuid,
  property_sku text,
  ai_context text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived')),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid REFERENCES public.marketing_creatives(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'youtube', 'meta_ads', 'google_ads', 'site')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  caption text,
  ai_context text,
  scheduled_for timestamptz,
  published_at timestamptz,
  external_id text,
  permalink text,
  error_message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('organic', 'paid', 'general', 'content')),
  period_start date,
  period_end date,
  title text NOT NULL,
  summary text,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'archived')),
  generated_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_creatives_status_updated
  ON public.marketing_creatives(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_creatives_campaign_type
  ON public.marketing_creatives(campaign_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_scheduled_posts_platform_status
  ON public.marketing_scheduled_posts(platform, status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_marketing_ai_reports_type_period
  ON public.marketing_ai_reports(report_type, period_end DESC);
