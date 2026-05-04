-- Phase 2: workflow foundation for agent follow-ups and rescue flows.

CREATE TABLE IF NOT EXISTS public.agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'lead_created'
    CHECK (trigger_type IN ('lead_created', 'lead_no_reply', 'lead_qualified', 'appointment_pending', 'manual')),
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  wait_for_online BOOLEAN NOT NULL DEFAULT false,
  preferred_send_time TEXT NOT NULL DEFAULT 'same_time'
    CHECK (preferred_send_time IN ('same_time', 'business_hours', 'anytime')),
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_workflows_trigger_active
  ON public.agent_workflows(trigger_type, is_active);

CREATE INDEX IF NOT EXISTS idx_agent_workflows_broker
  ON public.agent_workflows(broker_id)
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_workflows_instance
  ON public.agent_workflows(instance_id)
  WHERE instance_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agent_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.agent_workflows(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  lead_phone TEXT,
  lead_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting', 'sent', 'stopped', 'failed', 'completed')),
  trigger_type TEXT,
  current_node_id TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_workflow
  ON public.agent_workflow_runs(workflow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_lead
  ON public.agent_workflow_runs(lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_phone
  ON public.agent_workflow_runs(lead_phone, created_at DESC)
  WHERE lead_phone IS NOT NULL;

ALTER TABLE public.agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflow_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_workflows'
      AND policyname = 'service_role_full_access_agent_workflows'
  ) THEN
    CREATE POLICY "service_role_full_access_agent_workflows"
      ON public.agent_workflows
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_workflow_runs'
      AND policyname = 'service_role_full_access_agent_workflow_runs'
  ) THEN
    CREATE POLICY "service_role_full_access_agent_workflow_runs"
      ON public.agent_workflow_runs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
