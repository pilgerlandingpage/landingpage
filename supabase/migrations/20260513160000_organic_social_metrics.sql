-- Organic social metrics cache for Instagram/Facebook dashboards.
-- Keeps Meta Graph API reads off the hot path and gives the admin panel
-- a stable local history for organic performance.

CREATE TABLE IF NOT EXISTS public.organic_social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.organic_social_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.organic_social_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  media_type TEXT,
  media_product_type TEXT,
  caption TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  media_url TEXT,
  published_at TIMESTAMPTZ,
  like_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.organic_social_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.organic_social_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  followers_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_organic_social_profiles_platform
  ON public.organic_social_profiles (platform, last_synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_organic_social_media_profile_published
  ON public.organic_social_media (profile_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_organic_social_media_platform_product
  ON public.organic_social_media (platform, media_product_type, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_organic_social_daily_snapshots_profile_date
  ON public.organic_social_daily_snapshots (profile_id, snapshot_date DESC);

INSERT INTO public.app_config (key, value, description)
VALUES
  ('meta_facebook_page_id', '279328945567629', 'Pagina principal do Facebook usada para trafego organico.'),
  ('organic_social_sync_enabled', 'true', 'Ativa a sincronizacao automatica do trafego organico via Inngest.'),
  ('organic_social_sync_interval_minutes', '120', 'Intervalo minimo, em minutos, entre sincronizacoes automaticas do trafego organico.'),
  ('organic_social_sync_limit', '12', 'Quantidade de midias recentes do Instagram sincronizadas por execucao.'),
  ('organic_social_sync_last_run_at', '', 'Ultima sincronizacao concluida do trafego organico.'),
  ('organic_social_sync_last_started_at', '', 'Ultima sincronizacao iniciada do trafego organico.'),
  ('organic_social_sync_last_error', '', 'Ultimo erro da sincronizacao do trafego organico.'),
  ('organic_social_sync_last_error_at', '', 'Data/hora do ultimo erro da sincronizacao do trafego organico.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
