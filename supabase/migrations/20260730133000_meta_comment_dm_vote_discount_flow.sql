CREATE TABLE IF NOT EXISTS public.meta_comment_dm_flow_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.meta_comment_dm_campaigns(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.meta_comment_dm_deliveries(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'facebook')),
  recipient_id text NOT NULL,
  sender_id text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'error')),
  due_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  message text NOT NULL,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key text NOT NULL,
  error text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_meta_comment_dm_flow_followups_due
  ON public.meta_comment_dm_flow_followups(status, due_at);

CREATE INDEX IF NOT EXISTS idx_meta_comment_dm_flow_followups_delivery
  ON public.meta_comment_dm_flow_followups(delivery_id, status);
