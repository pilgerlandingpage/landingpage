-- WhatsApp Global phase 1: separate corporate/global instances from broker
-- instances and add auditable command/session tables.

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS instance_type TEXT NOT NULL DEFAULT 'broker';

UPDATE public.whatsapp_instances wi
SET instance_type = 'global',
    updated_at = now()
FROM public.app_config cfg
WHERE cfg.key = 'agent_default_instance_id'
  AND cfg.value = wi.id::text
  AND wi.instance_type <> 'global';

UPDATE public.whatsapp_instances
SET instance_type = 'global',
    updated_at = now()
WHERE lower(instance_name) IN ('agente global', 'whatsapp global')
  AND instance_type <> 'global';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_instances_instance_type_check'
  ) THEN
    ALTER TABLE public.whatsapp_instances
      ADD CONSTRAINT whatsapp_instances_instance_type_check
      CHECK (instance_type IN ('global', 'broker', 'sector', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_type
  ON public.whatsapp_instances(instance_type, status);

CREATE TABLE IF NOT EXISTS public.whatsapp_global_identity_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('admin_user', 'broker_user', 'property_owner', 'lead', 'blocked')),
  identity_id TEXT,
  display_name TEXT,
  permission_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_global_identity_overrides_lookup
  ON public.whatsapp_global_identity_overrides(phone)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.whatsapp_global_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  identity_type TEXT NOT NULL DEFAULT 'lead',
  identity_id TEXT,
  identity_label TEXT,
  permission_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_global_sessions_phone
  ON public.whatsapp_global_sessions(phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_global_sessions_recent
  ON public.whatsapp_global_sessions(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_global_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.whatsapp_global_sessions(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  identity_type TEXT NOT NULL DEFAULT 'lead',
  identity_id TEXT,
  identity_label TEXT,
  command_type TEXT NOT NULL DEFAULT 'general',
  target_agent TEXT NOT NULL DEFAULT 'whatsapp-global-agent',
  required_permission TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'blocked', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  command_text TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_global_commands_recent
  ON public.whatsapp_global_commands(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_global_commands_status
  ON public.whatsapp_global_commands(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_global_commands_agent
  ON public.whatsapp_global_commands(target_agent, created_at DESC);

ALTER TABLE public.whatsapp_global_identity_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_global_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_global_commands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_global_identity_overrides'
      AND policyname = 'service_role_full_access_whatsapp_global_identity_overrides'
  ) THEN
    CREATE POLICY "service_role_full_access_whatsapp_global_identity_overrides"
      ON public.whatsapp_global_identity_overrides
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_global_sessions'
      AND policyname = 'service_role_full_access_whatsapp_global_sessions'
  ) THEN
    CREATE POLICY "service_role_full_access_whatsapp_global_sessions"
      ON public.whatsapp_global_sessions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_global_commands'
      AND policyname = 'service_role_full_access_whatsapp_global_commands'
  ) THEN
    CREATE POLICY "service_role_full_access_whatsapp_global_commands"
      ON public.whatsapp_global_commands
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
