-- Phase 6: WhatsApp contact presence tracking for workflow send timing

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    jid TEXT,
    presence TEXT NOT NULL DEFAULT 'unknown',
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_online_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contact_presence_instance_phone
    ON public.whatsapp_contact_presence(instance_id, phone)
    WHERE instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_presence_phone
    ON public.whatsapp_contact_presence(phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_presence_online
    ON public.whatsapp_contact_presence(is_online, last_event_at DESC);

ALTER TABLE public.whatsapp_contact_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'whatsapp_contact_presence'
          AND policyname = 'service_role_full_access_whatsapp_contact_presence'
    ) THEN
        CREATE POLICY "service_role_full_access_whatsapp_contact_presence"
            ON public.whatsapp_contact_presence
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
