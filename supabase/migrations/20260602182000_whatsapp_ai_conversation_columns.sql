-- Keep the remote whatsapp_ai_conversations table compatible with agent code.

ALTER TABLE public.whatsapp_ai_conversations
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS lead_data_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qualification_score INTEGER,
  ADD COLUMN IF NOT EXISTS transferred_to_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_conv_lead_id
  ON public.whatsapp_ai_conversations(lead_id)
  WHERE lead_id IS NOT NULL;

UPDATE public.whatsapp_ai_conversations c
SET lead_id = l.id
FROM public.leads l
WHERE c.lead_id IS NULL
  AND regexp_replace(COALESCE(l.phone_e164, l.phone, ''), '\D', '', 'g') = regexp_replace(c.lead_phone, '\D', '', 'g');
