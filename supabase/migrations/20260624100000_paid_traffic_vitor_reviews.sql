-- Vitor paid traffic manager: reviews and draft campaign plans created from
-- WhatsApp Global commands and panel creative intake.

CREATE TABLE IF NOT EXISTS public.paid_traffic_creative_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID REFERENCES public.whatsapp_global_commands(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES public.marketing_creatives(id) ON DELETE SET NULL,
  requested_by_phone TEXT,
  requested_by_label TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp_global',
  asset_summary TEXT,
  briefing TEXT,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  score_label TEXT,
  status TEXT NOT NULL DEFAULT 'reviewed'
    CHECK (status IN ('queued', 'processing', 'reviewed', 'failed', 'cancelled', 'approved', 'needs_improvement')),
  recommendation TEXT,
  decision TEXT,
  strengths TEXT[] NOT NULL DEFAULT '{}'::text[],
  risks TEXT[] NOT NULL DEFAULT '{}'::text[],
  improvements TEXT[] NOT NULL DEFAULT '{}'::text[],
  persona JSONB NOT NULL DEFAULT '{}'::jsonb,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  campaign_angle JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_lead_quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_question TEXT,
  raw_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paid_traffic_campaign_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.paid_traffic_creative_reviews(id) ON DELETE SET NULL,
  command_id UUID REFERENCES public.whatsapp_global_commands(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES public.marketing_creatives(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_human_approval', 'approved', 'exported', 'published', 'paused', 'cancelled')),
  objective TEXT,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  budget_suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_days INTEGER,
  copy_variations JSONB NOT NULL DEFAULT '[]'::jsonb,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  pause_scale_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_traffic_reviews_command
  ON public.paid_traffic_creative_reviews(command_id);

CREATE INDEX IF NOT EXISTS idx_paid_traffic_reviews_creative
  ON public.paid_traffic_creative_reviews(creative_id);

CREATE INDEX IF NOT EXISTS idx_paid_traffic_reviews_status_score
  ON public.paid_traffic_creative_reviews(status, score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_paid_traffic_campaign_plans_review
  ON public.paid_traffic_campaign_plans(review_id);

CREATE INDEX IF NOT EXISTS idx_paid_traffic_campaign_plans_status
  ON public.paid_traffic_campaign_plans(status, created_at DESC);

ALTER TABLE public.paid_traffic_creative_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_traffic_campaign_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'paid_traffic_creative_reviews'
      AND policyname = 'service_role_full_access_paid_traffic_creative_reviews'
  ) THEN
    CREATE POLICY "service_role_full_access_paid_traffic_creative_reviews"
      ON public.paid_traffic_creative_reviews
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'paid_traffic_campaign_plans'
      AND policyname = 'service_role_full_access_paid_traffic_campaign_plans'
  ) THEN
    CREATE POLICY "service_role_full_access_paid_traffic_campaign_plans"
      ON public.paid_traffic_campaign_plans
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
