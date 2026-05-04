-- Adds the intelligence layer for the Market Radar.
-- The raw Google Trends score stays in market_radar_data; this table stores
-- Pilger's interpreted opportunity, recommendations, and AI analysis.

ALTER TABLE public.market_radar_data
  ADD COLUMN IF NOT EXISTS time_slot TEXT DEFAULT '00',
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT now();

UPDATE public.market_radar_data
SET time_slot = COALESCE(NULLIF(time_slot, ''), '00')
WHERE time_slot IS NULL OR time_slot = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_radar_data_pkey'
      AND conrelid = 'public.market_radar_data'::regclass
  ) THEN
    ALTER TABLE public.market_radar_data DROP CONSTRAINT market_radar_data_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_radar_data_pkey'
      AND conrelid = 'public.market_radar_data'::regclass
  ) THEN
    ALTER TABLE public.market_radar_data
      ADD CONSTRAINT market_radar_data_pkey PRIMARY KEY (radar_id, date, time_slot);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.market_radar_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radar_id UUID NOT NULL REFERENCES public.market_radars(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location TEXT,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL DEFAULT '00',
  trend_score INTEGER NOT NULL CHECK (trend_score >= 0 AND trend_score <= 100),
  previous_score INTEGER,
  trend_delta INTEGER NOT NULL DEFAULT 0,
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  market_temperature TEXT NOT NULL DEFAULT 'monitorar',
  summary TEXT NOT NULL,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_properties_count INTEGER NOT NULL DEFAULT 0,
  related_properties JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_leads_count INTEGER NOT NULL DEFAULT 0,
  content_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  campaign_recommendation TEXT,
  risk_notes TEXT,
  ai_analysis TEXT,
  source_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by TEXT NOT NULL DEFAULT 'radar_ai',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (radar_id, date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_market_radar_insights_radar_created
  ON public.market_radar_insights (radar_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_radar_insights_opportunity
  ON public.market_radar_insights (opportunity_score DESC, created_at DESC);
