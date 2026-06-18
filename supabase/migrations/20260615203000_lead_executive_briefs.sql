CREATE TABLE IF NOT EXISTS public.lead_executive_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    lead_phone TEXT,
    lead_name TEXT,
    crm_row_id TEXT,
    broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
    level TEXT NOT NULL CHECK (level IN ('high', 'medium', 'low')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    risk TEXT NOT NULL,
    next_action TEXT NOT NULL,
    facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL DEFAULT 'crm_manual_snapshot',
    actor_type TEXT,
    actor_id TEXT,
    actor_name TEXT,
    actor_email TEXT,
    auth_user_id TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_executive_briefs_lead_generated
    ON public.lead_executive_briefs(lead_id, generated_at DESC)
    WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_executive_briefs_level_generated
    ON public.lead_executive_briefs(level, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_executive_briefs_broker_generated
    ON public.lead_executive_briefs(broker_id, generated_at DESC)
    WHERE broker_id IS NOT NULL;

ALTER TABLE public.lead_executive_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages lead executive briefs" ON public.lead_executive_briefs;
CREATE POLICY "Service role manages lead executive briefs"
    ON public.lead_executive_briefs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
