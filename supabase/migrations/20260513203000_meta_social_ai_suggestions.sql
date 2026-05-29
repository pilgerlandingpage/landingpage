CREATE TABLE IF NOT EXISTS public.meta_social_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('comment', 'message', 'thread')),
  source_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  intent text NOT NULL DEFAULT 'geral',
  sentiment text NOT NULL DEFAULT 'neutro',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  lead_score integer NOT NULL DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  summary text,
  suggested_reply text,
  recommended_action text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'dismissed')),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_social_ai_suggestions_priority
  ON public.meta_social_ai_suggestions(priority, lead_score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_social_ai_suggestions_platform
  ON public.meta_social_ai_suggestions(platform, updated_at DESC);
