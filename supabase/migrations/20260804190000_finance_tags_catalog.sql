-- Structured finance tags for assistant-created classifications.
-- Non-destructive: adds optional catalog/link tables used by WhatsApp Global finance.

CREATE TABLE IF NOT EXISTS public.finance_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_entry_tags (
  entry_id UUID NOT NULL REFERENCES public.finance_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.finance_payable_tags (
  payable_id UUID NOT NULL REFERENCES public.finance_payables(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payable_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_tags_active ON public.finance_tags(is_active, name);
CREATE INDEX IF NOT EXISTS idx_finance_entry_tags_tag ON public.finance_entry_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_finance_payable_tags_tag ON public.finance_payable_tags(tag_id);

ALTER TABLE public.finance_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payable_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_tags'
      AND policyname = 'service_role_full_access_finance_tags'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_tags"
      ON public.finance_tags FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_entry_tags'
      AND policyname = 'service_role_full_access_finance_entry_tags'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_entry_tags"
      ON public.finance_entry_tags FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_payable_tags'
      AND policyname = 'service_role_full_access_finance_payable_tags'
  ) THEN
    CREATE POLICY "service_role_full_access_finance_payable_tags"
      ON public.finance_payable_tags FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
