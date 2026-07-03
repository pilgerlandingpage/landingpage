-- Editorial image memory for blog/news cover and inline media selection.
-- Keeps provider metadata and usage history so the agents avoid repeated covers.

CREATE TABLE IF NOT EXISTS public.editorial_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_asset_id TEXT NOT NULL,
  source_url TEXT,
  image_url TEXT NOT NULL,
  preview_url TEXT,
  r2_url TEXT,
  r2_key TEXT,
  author_name TEXT,
  author_url TEXT,
  license TEXT,
  width INTEGER,
  height INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  alt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT editorial_media_assets_provider_asset_unique UNIQUE (provider, provider_asset_id)
);

CREATE TABLE IF NOT EXISTS public.editorial_post_media_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.editorial_media_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'cover' CHECK (role IN ('cover', 'inline', 'thumbnail')),
  content_type TEXT CHECK (content_type IN ('blog', 'news')),
  source_query TEXT,
  image_url TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_editorial_media_assets_last_used
  ON public.editorial_media_assets(last_used_at DESC NULLS LAST, used_count DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_media_assets_provider_asset
  ON public.editorial_media_assets(provider, provider_asset_id);

CREATE INDEX IF NOT EXISTS idx_editorial_media_assets_source_url
  ON public.editorial_media_assets(source_url);

CREATE INDEX IF NOT EXISTS idx_editorial_post_media_usage_post
  ON public.editorial_post_media_usage(post_id, role, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_post_media_usage_asset
  ON public.editorial_post_media_usage(asset_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_post_media_usage_content
  ON public.editorial_post_media_usage(content_type, role, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at_for_editorial_media
  ON public.blog_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_cover_created_at_for_editorial_media
  ON public.blog_posts(created_at DESC)
  WHERE cover_image_url IS NOT NULL;

ALTER TABLE public.editorial_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_post_media_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'editorial_media_assets'
      AND policyname = 'service_role_full_access_editorial_media_assets'
  ) THEN
    CREATE POLICY "service_role_full_access_editorial_media_assets"
      ON public.editorial_media_assets
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'editorial_post_media_usage'
      AND policyname = 'service_role_full_access_editorial_post_media_usage'
  ) THEN
    CREATE POLICY "service_role_full_access_editorial_post_media_usage"
      ON public.editorial_post_media_usage
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
