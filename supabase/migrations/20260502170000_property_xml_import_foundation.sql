-- Foundation for importing the legacy XML catalog without exposing private data.
-- This migration is intentionally additive: it preserves the existing public
-- properties table and stores owner/internal fields in separate admin-only tables.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS source_slug TEXT,
  ADD COLUMN IF NOT EXISTS source_status TEXT,
  ADD COLUMN IF NOT EXISTS source_visible BOOLEAN,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS suites INTEGER,
  ADD COLUMN IF NOT EXISTS parking_spaces INTEGER,
  ADD COLUMN IF NOT EXISTS rent DECIMAL,
  ADD COLUMN IF NOT EXISTS condo_fee DECIMAL,
  ADD COLUMN IF NOT EXISTS iptu DECIMAL,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS area_private_m2 DECIMAL,
  ADD COLUMN IF NOT EXISTS area_total_m2 DECIMAL,
  ADD COLUMN IF NOT EXISTS exclusive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solar_position TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_properties_source_reference
  ON public.properties (source_system, source_reference);

CREATE TABLE IF NOT EXISTS public.property_private_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_system TEXT,
  source_reference TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_phones TEXT,
  sale_authorization_signed BOOLEAN,
  registry TEXT,
  liens TEXT,
  keys_location TEXT,
  internal_notes TEXT,
  client_reference TEXT,
  sign_info TEXT,
  broker_name TEXT,
  broker_login TEXT,
  created_by_name TEXT,
  condominium_name TEXT,
  construction_company TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_property_private_details_property_id
  ON public.property_private_details (property_id);

CREATE INDEX IF NOT EXISTS idx_property_private_details_source
  ON public.property_private_details (source_system, source_reference);

CREATE TABLE IF NOT EXISTS public.property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_system TEXT,
  source_reference TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  position INTEGER NOT NULL DEFAULT 0,
  original_path TEXT,
  original_url TEXT,
  r2_key TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  is_featured BOOLEAN DEFAULT false,
  download_status TEXT DEFAULT 'pending',
  download_error TEXT,
  content_type TEXT,
  byte_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_property_media_source_position
  ON public.property_media (source_system, source_reference, media_type, position);

CREATE INDEX IF NOT EXISTS idx_property_media_property_id
  ON public.property_media (property_id, media_type, position);

CREATE TABLE IF NOT EXISTS public.property_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL DEFAULT 'legacy_xml',
  source_reference TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_import_logs_source
  ON public.property_import_logs (source_system, source_reference, created_at DESC);

ALTER TABLE public.property_private_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_import_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_private_details'
      AND policyname = 'service_role_full_access_property_private_details'
  ) THEN
    CREATE POLICY "service_role_full_access_property_private_details"
      ON public.property_private_details FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_media'
      AND policyname = 'public_can_read_property_media'
  ) THEN
    CREATE POLICY "public_can_read_property_media"
      ON public.property_media FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_media'
      AND policyname = 'service_role_manage_property_media'
  ) THEN
    CREATE POLICY "service_role_manage_property_media"
      ON public.property_media FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_import_logs'
      AND policyname = 'service_role_full_access_property_import_logs'
  ) THEN
    CREATE POLICY "service_role_full_access_property_import_logs"
      ON public.property_import_logs FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
