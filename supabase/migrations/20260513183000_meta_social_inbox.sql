CREATE TABLE IF NOT EXISTS public.meta_social_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  external_id text NOT NULL,
  thread_type text NOT NULL DEFAULT 'direct',
  profile_id uuid REFERENCES public.organic_social_profiles(id) ON DELETE SET NULL,
  participant_id text,
  participant_name text,
  participant_avatar_url text,
  status text NOT NULL DEFAULT 'open',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.meta_social_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.meta_social_threads(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  external_id text NOT NULL,
  sender_id text,
  sender_name text,
  recipient_id text,
  recipient_name text,
  direction text NOT NULL DEFAULT 'unknown' CHECK (direction IN ('inbound', 'outbound', 'unknown')),
  message text,
  attachment_type text,
  attachment_url text,
  permalink text,
  sent_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.meta_social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  external_id text NOT NULL,
  profile_id uuid REFERENCES public.organic_social_profiles(id) ON DELETE SET NULL,
  media_id uuid REFERENCES public.organic_social_media(id) ON DELETE SET NULL,
  media_external_id text,
  parent_external_id text,
  author_id text,
  author_name text,
  message text,
  like_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  permalink text,
  is_hidden boolean NOT NULL DEFAULT false,
  commented_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.meta_social_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text,
  event_type text,
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_social_threads_platform_updated
  ON public.meta_social_threads(platform, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_social_messages_thread_sent
  ON public.meta_social_messages(thread_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_social_comments_platform_time
  ON public.meta_social_comments(platform, commented_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_social_comments_media
  ON public.meta_social_comments(media_external_id);

CREATE INDEX IF NOT EXISTS idx_meta_social_webhook_events_created
  ON public.meta_social_webhook_events(created_at DESC);

INSERT INTO public.app_config (key, value, description)
VALUES
  ('meta_social_inbox_enabled', 'true', 'Ativa sincronizacao de comentarios e mensagens Meta.'),
  ('meta_webhook_verify_token', 'pilger-meta-webhook', 'Token de verificacao do webhook Meta.')
ON CONFLICT (key) DO NOTHING;
