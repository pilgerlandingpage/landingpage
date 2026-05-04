-- Phase 3: workflow audit trail, per-lead state and manual run support.

ALTER TABLE public.agent_workflow_runs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT,
  ADD COLUMN IF NOT EXISTS node_results JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.agent_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.agent_workflow_runs(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.agent_workflows(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  lead_phone TEXT,
  event_type TEXT NOT NULL,
  node_id TEXT,
  status TEXT,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_events_run
  ON public.agent_workflow_events(run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_events_workflow
  ON public.agent_workflow_events(workflow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_events_phone
  ON public.agent_workflow_events(lead_phone, created_at DESC)
  WHERE lead_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agent_workflow_lead_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.agent_workflows(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_phone TEXT NOT NULL,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'queued', 'running', 'waiting', 'sent', 'stopped', 'failed', 'completed')),
  last_run_id UUID REFERENCES public.agent_workflow_runs(id) ON DELETE SET NULL,
  last_trigger_type TEXT,
  last_sent_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  next_allowed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_workflow_lead_state_unique
  ON public.agent_workflow_lead_state(workflow_id, lead_phone);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_lead_state_phone
  ON public.agent_workflow_lead_state(lead_phone, updated_at DESC);

ALTER TABLE public.agent_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflow_lead_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_workflow_events'
      AND policyname = 'service_role_full_access_agent_workflow_events'
  ) THEN
    CREATE POLICY "service_role_full_access_agent_workflow_events"
      ON public.agent_workflow_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_workflow_lead_state'
      AND policyname = 'service_role_full_access_agent_workflow_lead_state'
  ) THEN
    CREATE POLICY "service_role_full_access_agent_workflow_lead_state"
      ON public.agent_workflow_lead_state
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
