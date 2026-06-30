-- Daily broker attendance history.
-- Keeps one operational memory row per broker/instance/day and links it to the
-- Central de Inteligencia event/snapshot produced by the attendance coach.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.broker_attendance_daily_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.broker_attendance_reports(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  admin_user_id UUID,
  broker_key TEXT NOT NULL,
  broker_name TEXT,
  owner_type TEXT,
  owner_phone TEXT,
  report_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  professional_status TEXT,
  summary TEXT,
  coaching_report TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  attention_points JSONB DEFAULT '[]'::jsonb,
  improvement_points JSONB DEFAULT '[]'::jsonb,
  training_focus JSONB DEFAULT '[]'::jsonb,
  recovery_actions JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  coverage JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  conversation_stats JSONB DEFAULT '{}'::jsonb,
  risk_stats JSONB DEFAULT '{}'::jsonb,
  central_event_id UUID REFERENCES public.ecosystem_events(id) ON DELETE SET NULL,
  central_snapshot_id UUID REFERENCES public.ecosystem_context_snapshots(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (broker_key, instance_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_daily_history_broker_date
  ON public.broker_attendance_daily_history(broker_key, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_daily_history_report_date
  ON public.broker_attendance_daily_history(report_date DESC);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_daily_history_instance
  ON public.broker_attendance_daily_history(instance_id);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_daily_history_broker
  ON public.broker_attendance_daily_history(broker_id);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_daily_history_metrics
  ON public.broker_attendance_daily_history USING GIN(metrics);

CREATE OR REPLACE FUNCTION public.update_broker_attendance_daily_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_attendance_daily_history_updated_at
  ON public.broker_attendance_daily_history;

CREATE TRIGGER broker_attendance_daily_history_updated_at
BEFORE UPDATE ON public.broker_attendance_daily_history
FOR EACH ROW EXECUTE FUNCTION public.update_broker_attendance_daily_history_updated_at();

ALTER TABLE public.broker_attendance_daily_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages broker attendance daily history"
  ON public.broker_attendance_daily_history;

CREATE POLICY "Service role manages broker attendance daily history"
ON public.broker_attendance_daily_history
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
