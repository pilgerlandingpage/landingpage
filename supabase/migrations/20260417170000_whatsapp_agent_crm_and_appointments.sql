-- CRM interno de leads + agenda de visitas para WhatsApp Agent

CREATE TABLE IF NOT EXISTS public.lead_collected_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone TEXT NOT NULL UNIQUE,
  lead_name TEXT,
  interest TEXT,
  region TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  bedrooms_wanted INTEGER,
  property_type TEXT,
  timeline TEXT,
  qualification_score INTEGER NOT NULL DEFAULT 0 CHECK (qualification_score >= 0 AND qualification_score <= 100),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualifying', 'qualified', 'transferred', 'converted', 'lost')),
  notes TEXT,
  documents_received JSONB NOT NULL DEFAULT '[]'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_collected_status ON public.lead_collected_data(status);
CREATE INDEX IF NOT EXISTS idx_lead_collected_score ON public.lead_collected_data(qualification_score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_collected_updated_at ON public.lead_collected_data(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone TEXT NOT NULL,
  lead_name TEXT,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'visita',
  property_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments(lead_phone);

ALTER TABLE public.whatsapp_ai_conversations
  ADD COLUMN IF NOT EXISTS human_takeover_at TIMESTAMPTZ;

ALTER TABLE public.lead_collected_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='lead_collected_data' AND policyname='service_role_full_access_lead_collected_data'
  ) THEN
    CREATE POLICY "service_role_full_access_lead_collected_data" ON public.lead_collected_data
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='appointments' AND policyname='service_role_full_access_appointments'
  ) THEN
    CREATE POLICY "service_role_full_access_appointments" ON public.appointments
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
