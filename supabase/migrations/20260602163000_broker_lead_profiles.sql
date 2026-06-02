-- Multi-broker CRM ownership.
-- A lead remains global in public.leads, while each AI broker gets its own
-- CRM profile/status/notes for the same phone.

CREATE TABLE IF NOT EXISTS public.broker_lead_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_phone TEXT NOT NULL,
  broker_id UUID NOT NULL REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.whatsapp_ai_conversations(id) ON DELETE SET NULL,
  lead_name TEXT,
  interest TEXT,
  region TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  bedrooms_wanted INTEGER,
  property_type TEXT,
  timeline TEXT,
  qualification_score INTEGER NOT NULL DEFAULT 0 CHECK (qualification_score >= 0 AND qualification_score <= 100),
  lead_classification TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualifying', 'qualified', 'transferred', 'converted', 'lost')),
  notes TEXT,
  documents_received JSONB NOT NULL DEFAULT '[]'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  first_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT broker_lead_profiles_unique_broker_phone UNIQUE (broker_id, lead_phone)
);

CREATE INDEX IF NOT EXISTS idx_broker_lead_profiles_broker_updated
  ON public.broker_lead_profiles (broker_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_lead_profiles_phone
  ON public.broker_lead_profiles (lead_phone);

CREATE INDEX IF NOT EXISTS idx_broker_lead_profiles_lead_id
  ON public.broker_lead_profiles (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broker_lead_profiles_conversation
  ON public.broker_lead_profiles (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.broker_lead_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_lead_profiles'
      AND policyname = 'service_role_full_access_broker_lead_profiles'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_lead_profiles"
      ON public.broker_lead_profiles
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.broker_lead_profiles (
  lead_id,
  lead_phone,
  broker_id,
  lead_name,
  interest,
  region,
  budget_min,
  budget_max,
  bedrooms_wanted,
  property_type,
  timeline,
  qualification_score,
  status,
  notes,
  documents_received,
  latitude,
  longitude,
  created_at,
  updated_at,
  first_contact_at,
  last_message_at
)
SELECT DISTINCT ON (lcd.broker_id, regexp_replace(lcd.lead_phone, '\D', '', 'g'))
  l.id,
  regexp_replace(lcd.lead_phone, '\D', '', 'g') AS lead_phone,
  lcd.broker_id,
  lcd.lead_name,
  lcd.interest,
  lcd.region,
  lcd.budget_min,
  lcd.budget_max,
  lcd.bedrooms_wanted,
  lcd.property_type,
  lcd.timeline,
  lcd.qualification_score,
  lcd.status,
  lcd.notes,
  lcd.documents_received,
  lcd.latitude,
  lcd.longitude,
  lcd.created_at,
  lcd.updated_at,
  lcd.created_at,
  lcd.updated_at
FROM public.lead_collected_data lcd
JOIN public.virtual_brokers vb
  ON vb.id = lcd.broker_id
LEFT JOIN public.leads l
  ON regexp_replace(COALESCE(l.phone_e164, l.phone, ''), '\D', '', 'g') = regexp_replace(lcd.lead_phone, '\D', '', 'g')
WHERE lcd.broker_id IS NOT NULL
  AND regexp_replace(lcd.lead_phone, '\D', '', 'g') <> ''
ORDER BY lcd.broker_id, regexp_replace(lcd.lead_phone, '\D', '', 'g'), lcd.updated_at DESC
ON CONFLICT (broker_id, lead_phone) DO UPDATE SET
  lead_id = COALESCE(EXCLUDED.lead_id, broker_lead_profiles.lead_id),
  lead_name = COALESCE(EXCLUDED.lead_name, broker_lead_profiles.lead_name),
  interest = COALESCE(EXCLUDED.interest, broker_lead_profiles.interest),
  region = COALESCE(EXCLUDED.region, broker_lead_profiles.region),
  budget_min = COALESCE(EXCLUDED.budget_min, broker_lead_profiles.budget_min),
  budget_max = COALESCE(EXCLUDED.budget_max, broker_lead_profiles.budget_max),
  bedrooms_wanted = COALESCE(EXCLUDED.bedrooms_wanted, broker_lead_profiles.bedrooms_wanted),
  property_type = COALESCE(EXCLUDED.property_type, broker_lead_profiles.property_type),
  timeline = COALESCE(EXCLUDED.timeline, broker_lead_profiles.timeline),
  qualification_score = GREATEST(EXCLUDED.qualification_score, broker_lead_profiles.qualification_score),
  status = EXCLUDED.status,
  notes = COALESCE(EXCLUDED.notes, broker_lead_profiles.notes),
  documents_received = COALESCE(EXCLUDED.documents_received, broker_lead_profiles.documents_received),
  latitude = COALESCE(EXCLUDED.latitude, broker_lead_profiles.latitude),
  longitude = COALESCE(EXCLUDED.longitude, broker_lead_profiles.longitude),
  first_contact_at = LEAST(EXCLUDED.first_contact_at, broker_lead_profiles.first_contact_at),
  last_message_at = GREATEST(EXCLUDED.last_message_at, broker_lead_profiles.last_message_at),
  updated_at = GREATEST(EXCLUDED.updated_at, broker_lead_profiles.updated_at);

INSERT INTO public.broker_lead_profiles (
  lead_id,
  lead_phone,
  broker_id,
  instance_id,
  conversation_id,
  lead_name,
  status,
  qualification_score,
  created_at,
  updated_at,
  first_contact_at,
  last_message_at
)
SELECT DISTINCT ON (c.broker_id, regexp_replace(c.lead_phone, '\D', '', 'g'))
  l.id,
  regexp_replace(c.lead_phone, '\D', '', 'g') AS lead_phone,
  c.broker_id,
  c.instance_id,
  c.id,
  l.name,
  CASE
    WHEN c.status = 'transferred' THEN 'transferred'
    ELSE 'new'
  END,
  COALESCE(l.lead_score, 0),
  c.created_at,
  c.updated_at,
  c.created_at,
  c.updated_at
FROM public.whatsapp_ai_conversations c
JOIN public.virtual_brokers vb
  ON vb.id = c.broker_id
LEFT JOIN public.leads l
  ON regexp_replace(COALESCE(l.phone_e164, l.phone, ''), '\D', '', 'g') = regexp_replace(c.lead_phone, '\D', '', 'g')
WHERE c.broker_id IS NOT NULL
  AND regexp_replace(c.lead_phone, '\D', '', 'g') <> ''
ORDER BY c.broker_id, regexp_replace(c.lead_phone, '\D', '', 'g'), c.updated_at DESC
ON CONFLICT (broker_id, lead_phone) DO UPDATE SET
  lead_id = COALESCE(EXCLUDED.lead_id, broker_lead_profiles.lead_id),
  instance_id = COALESCE(EXCLUDED.instance_id, broker_lead_profiles.instance_id),
  conversation_id = COALESCE(EXCLUDED.conversation_id, broker_lead_profiles.conversation_id),
  lead_name = COALESCE(broker_lead_profiles.lead_name, EXCLUDED.lead_name),
  qualification_score = GREATEST(EXCLUDED.qualification_score, broker_lead_profiles.qualification_score),
  first_contact_at = LEAST(EXCLUDED.first_contact_at, broker_lead_profiles.first_contact_at),
  last_message_at = GREATEST(EXCLUDED.last_message_at, broker_lead_profiles.last_message_at),
  updated_at = GREATEST(EXCLUDED.updated_at, broker_lead_profiles.updated_at);
