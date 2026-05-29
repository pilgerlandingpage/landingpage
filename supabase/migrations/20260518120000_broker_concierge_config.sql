-- Phase 2: broker concierge configuration.
-- Adds a second, owner-facing prompt and granular permissions without changing
-- the current lead atendimento flow.

ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS concierge_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concierge_prompt TEXT,
  ADD COLUMN IF NOT EXISTS concierge_require_confirmation BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.broker_assistant_authorized_phones
  ADD COLUMN IF NOT EXISTS can_manage_finance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_properties BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_virtual_brokers_concierge_enabled
  ON public.virtual_brokers(concierge_enabled)
  WHERE concierge_enabled = true;
