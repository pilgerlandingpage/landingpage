CREATE TABLE IF NOT EXISTS public.meta_comment_dm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'facebook')),
  media_external_id text,
  post_permalink text,
  trigger_intent text NOT NULL,
  trigger_examples text[] NOT NULL DEFAULT '{}'::text[],
  reply_message text NOT NULL,
  confidence_threshold integer NOT NULL DEFAULT 72 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 100),
  mode text NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'auto')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  max_replies_per_hour integer NOT NULL DEFAULT 60 CHECK (max_replies_per_hour >= 1 AND max_replies_per_hour <= 1000),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meta_comment_dm_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.meta_comment_dm_campaigns(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.meta_social_comments(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'facebook')),
  comment_external_id text NOT NULL,
  media_external_id text,
  author_id text,
  author_name text,
  comment_text text,
  ai_matches boolean NOT NULL DEFAULT false,
  ai_confidence integer NOT NULL DEFAULT 0 CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  ai_reason text,
  normalized_intent text,
  reply_message text,
  decision text NOT NULL DEFAULT 'skipped' CHECK (decision IN ('matched', 'not_matched', 'needs_review', 'skipped', 'error')),
  send_status text NOT NULL DEFAULT 'skipped' CHECK (send_status IN ('pending_approval', 'sent', 'skipped', 'error')),
  private_reply_external_id text,
  private_reply_channel text,
  error text,
  processed_at timestamptz,
  sent_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, comment_external_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_comment_dm_campaigns_active
  ON public.meta_comment_dm_campaigns(platform, status, media_external_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_comment_dm_deliveries_status
  ON public.meta_comment_dm_deliveries(send_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_comment_dm_deliveries_comment
  ON public.meta_comment_dm_deliveries(comment_external_id);

INSERT INTO public.app_config (key, value, description)
VALUES
  ('meta_comment_dm_automation_enabled', 'true', 'Ativa automacao de Direct por comentario no Instagram.'),
  ('meta_comment_dm_webhook_autoprocess', 'true', 'Processa comentarios recebidos por webhook Meta em tempo real.'),
  ('meta_comment_dm_cron_enabled', 'true', 'Ativa varredura recorrente dos comentarios sincronizados para automacao de Direct.')
ON CONFLICT (key) DO NOTHING;
