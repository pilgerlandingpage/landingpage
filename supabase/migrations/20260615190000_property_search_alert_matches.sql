ALTER TABLE public.property_search_alerts
    ADD COLUMN IF NOT EXISTS match_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_match_property_ids TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.property_search_alert_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.property_search_alerts(id) ON DELETE CASCADE,
    visitor_id UUID REFERENCES public.visitors(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL DEFAULT 0,
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    notification_channels JSONB NOT NULL DEFAULT '["push"]'::jsonb,
    notification_status TEXT NOT NULL DEFAULT 'queued',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_search_alert_matches_unique
    ON public.property_search_alert_matches(alert_id, property_id);

CREATE INDEX IF NOT EXISTS idx_property_search_alert_matches_property
    ON public.property_search_alert_matches(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_search_alert_matches_visitor
    ON public.property_search_alert_matches(visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_search_alert_matches_status
    ON public.property_search_alert_matches(notification_status, created_at DESC);

ALTER TABLE public.property_search_alert_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages property search alert matches" ON public.property_search_alert_matches;
CREATE POLICY "Service role manages property search alert matches"
    ON public.property_search_alert_matches
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
