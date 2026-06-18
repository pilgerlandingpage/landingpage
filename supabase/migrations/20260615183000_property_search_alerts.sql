CREATE TABLE IF NOT EXISTS public.property_search_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    alert_hash TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Alerta de busca',
    search_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    filters JSONB NOT NULL DEFAULT '[]'::jsonb,
    map_bounds JSONB,
    draw_area JSONB,
    selected_region TEXT,
    result_count INTEGER NOT NULL DEFAULT 0,
    sample_property_ids TEXT[] NOT NULL DEFAULT '{}',
    notification_channels JSONB NOT NULL DEFAULT '["push"]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_matched_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_search_alerts_visitor_hash
    ON public.property_search_alerts(visitor_id, alert_hash);

CREATE INDEX IF NOT EXISTS idx_property_search_alerts_lead_id
    ON public.property_search_alerts(lead_id);

CREATE INDEX IF NOT EXISTS idx_property_search_alerts_status_updated
    ON public.property_search_alerts(status, updated_at DESC);

ALTER TABLE public.property_search_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages property search alerts" ON public.property_search_alerts;
CREATE POLICY "Service role manages property search alerts"
    ON public.property_search_alerts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
