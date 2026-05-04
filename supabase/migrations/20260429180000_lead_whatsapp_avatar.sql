-- Store WhatsApp profile photos when privacy allows the API to read them.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_source TEXT,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_avatar_updated_at
  ON public.leads(avatar_updated_at DESC)
  WHERE avatar_url IS NOT NULL;
