-- Improves admin property filtering by status and recent creation date.

ALTER TABLE public.properties
  ALTER COLUMN status SET DEFAULT 'under_review';

CREATE INDEX IF NOT EXISTS idx_properties_admin_status_created_at
  ON public.properties (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_admin_type_city
  ON public.properties (property_type, city);
