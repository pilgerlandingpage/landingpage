-- Broker assistant mode: authorized phones, isolated history and audited actions.

CREATE TABLE IF NOT EXISTS public.broker_assistant_authorized_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'broker',
  can_manage_agenda BOOLEAN NOT NULL DEFAULT true,
  can_manage_leads BOOLEAN NOT NULL DEFAULT false,
  can_send_messages BOOLEAN NOT NULL DEFAULT false,
  can_update_crm BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_assistant_authorized_phones_scope
  ON public.broker_assistant_authorized_phones(broker_id, phone);

CREATE INDEX IF NOT EXISTS idx_broker_assistant_authorized_phones_lookup
  ON public.broker_assistant_authorized_phones(phone, broker_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.broker_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  authorized_phone_id UUID REFERENCES public.broker_assistant_authorized_phones(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_assistant_conversations_scope
  ON public.broker_assistant_conversations(broker_id, phone);

CREATE INDEX IF NOT EXISTS idx_broker_assistant_conversations_recent
  ON public.broker_assistant_conversations(broker_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.broker_assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.broker_assistant_conversations(id) ON DELETE SET NULL,
  broker_id UUID NOT NULL REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  authorized_phone_id UUID REFERENCES public.broker_assistant_authorized_phones(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'executed', 'cancelled', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_assistant_actions_broker_status
  ON public.broker_assistant_actions(broker_id, status, created_at DESC);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'cancelled',
    'completed',
    'pendente_disponibilidade',
    'pendente_corretor',
    'aguardando_proprietario',
    'reagendar',
    'expirado'
  ));

ALTER TABLE public.broker_assistant_authorized_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_assistant_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_assistant_authorized_phones'
      AND policyname = 'service_role_full_access_broker_assistant_authorized_phones'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_assistant_authorized_phones"
      ON public.broker_assistant_authorized_phones
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_assistant_conversations'
      AND policyname = 'service_role_full_access_broker_assistant_conversations'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_assistant_conversations"
      ON public.broker_assistant_conversations
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_assistant_actions'
      AND policyname = 'service_role_full_access_broker_assistant_actions'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_assistant_actions"
      ON public.broker_assistant_actions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
