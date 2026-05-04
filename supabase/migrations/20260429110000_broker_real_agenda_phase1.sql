-- Phase 1: real broker agenda for WhatsApp agents.
-- Adds weekly availability and schedule blocks while keeping the existing
-- appointments table backward compatible.

CREATE TABLE IF NOT EXISTS public.broker_weekly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_weekly_availability_scope
  ON public.broker_weekly_availability (
    COALESCE(admin_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(broker_id, '00000000-0000-0000-0000-000000000000'::uuid),
    weekday
  );

CREATE INDEX IF NOT EXISTS idx_broker_weekly_availability_broker
  ON public.broker_weekly_availability(broker_id, weekday)
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broker_weekly_availability_admin_user
  ON public.broker_weekly_availability(admin_user_id, weekday)
  WHERE admin_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.broker_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_schedule_blocks_broker_date
  ON public.broker_schedule_blocks(broker_id, block_date)
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broker_schedule_blocks_admin_date
  ON public.broker_schedule_blocks(admin_user_id, block_date)
  WHERE admin_user_id IS NOT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_appointments_broker_datetime
  ON public.appointments(broker_id, scheduled_start_at)
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_admin_datetime
  ON public.appointments(admin_user_id, scheduled_start_at)
  WHERE admin_user_id IS NOT NULL;

ALTER TABLE public.broker_weekly_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_schedule_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_weekly_availability'
      AND policyname = 'service_role_full_access_broker_weekly_availability'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_weekly_availability"
      ON public.broker_weekly_availability
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broker_schedule_blocks'
      AND policyname = 'service_role_full_access_broker_schedule_blocks'
  ) THEN
    CREATE POLICY "service_role_full_access_broker_schedule_blocks"
      ON public.broker_schedule_blocks
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
