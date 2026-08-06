CREATE TABLE IF NOT EXISTS public.meta_whatsapp_contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  source_file_name TEXT,
  source_sheet_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  total_contacts INTEGER NOT NULL DEFAULT 0 CHECK (total_contacts >= 0),
  valid_contacts INTEGER NOT NULL DEFAULT 0 CHECK (valid_contacts >= 0),
  duplicate_contacts INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_contacts >= 0),
  invalid_contacts INTEGER NOT NULL DEFAULT 0 CHECK (invalid_contacts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_contact_lists_status
  ON public.meta_whatsapp_contact_lists(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_contact_list_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.meta_whatsapp_contact_lists(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  name TEXT,
  email TEXT,
  city TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  template_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_contact_list_contacts_list
  ON public.meta_whatsapp_contact_list_contacts(list_id, name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_contact_list_contacts_phone
  ON public.meta_whatsapp_contact_list_contacts(phone_e164);

ALTER TABLE public.meta_whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS meta_whatsapp_campaigns_audience_source_check;

ALTER TABLE public.meta_whatsapp_campaigns
  ADD CONSTRAINT meta_whatsapp_campaigns_audience_source_check
  CHECK (audience_source IN (
    'custom_paste',
    'saved_contact_list',
    'lead_filter',
    'commerce_customers',
    'education_leads',
    'editorial_distribution'
  ));

DROP TRIGGER IF EXISTS meta_whatsapp_contact_lists_updated_at ON public.meta_whatsapp_contact_lists;
CREATE TRIGGER meta_whatsapp_contact_lists_updated_at
BEFORE UPDATE ON public.meta_whatsapp_contact_lists
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_contact_list_contacts_updated_at ON public.meta_whatsapp_contact_list_contacts;
CREATE TRIGGER meta_whatsapp_contact_list_contacts_updated_at
BEFORE UPDATE ON public.meta_whatsapp_contact_list_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'meta_whatsapp_contact_lists',
    'meta_whatsapp_contact_list_contacts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'service_role_full_access_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        'service_role_full_access_' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.meta_whatsapp_contact_lists IS
  'Listas salvas de contatos com opt-in para campanhas oficiais Meta WhatsApp.';

COMMENT ON TABLE public.meta_whatsapp_contact_list_contacts IS
  'Contatos normalizados, variaveis e metadados importados para listas reutilizaveis de campanhas Meta WhatsApp.';
