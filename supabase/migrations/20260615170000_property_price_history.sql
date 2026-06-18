-- Stores public-facing financial history for property listings.
-- This powers price/tax history on listing detail pages and keeps admin edits auditable.

CREATE TABLE IF NOT EXISTS public.property_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'financial_update',
  previous_price DECIMAL,
  new_price DECIMAL,
  previous_condo_fee DECIMAL,
  new_condo_fee DECIMAL,
  previous_iptu DECIMAL,
  new_iptu DECIMAL,
  previous_price_per_m2 DECIMAL,
  new_price_per_m2 DECIMAL,
  area_m2 DECIMAL,
  source TEXT NOT NULL DEFAULT 'admin',
  changed_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_price_history_property_created
  ON public.property_price_history (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_price_history_event_type
  ON public.property_price_history (event_type, created_at DESC);

ALTER TABLE public.property_price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_price_history'
      AND policyname = 'public_can_read_property_price_history'
  ) THEN
    CREATE POLICY "public_can_read_property_price_history"
      ON public.property_price_history FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_price_history'
      AND policyname = 'service_role_manage_property_price_history'
  ) THEN
    CREATE POLICY "service_role_manage_property_price_history"
      ON public.property_price_history FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.property_price_history IS 'Timeline of listing price, condo fee, and IPTU changes used by public property detail pages.';
COMMENT ON COLUMN public.property_price_history.event_type IS 'listed, price_increased, price_reduced, price_updated, costs_updated, or financial_update.';
