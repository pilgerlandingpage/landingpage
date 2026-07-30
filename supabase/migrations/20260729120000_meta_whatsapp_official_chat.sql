CREATE TABLE IF NOT EXISTS public.meta_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.meta_whatsapp_senders(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  last_campaign_id UUID REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE SET NULL,
  last_recipient_id UUID REFERENCES public.meta_whatsapp_campaign_recipients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'closed', 'archived')),
  assigned_to_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  customer_window_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_conversations_status
  ON public.meta_whatsapp_conversations(status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_conversations_contact
  ON public.meta_whatsapp_conversations(contact_phone, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_conversations_campaign
  ON public.meta_whatsapp_conversations(last_campaign_id, last_message_at DESC)
  WHERE last_campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.meta_whatsapp_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.meta_whatsapp_senders(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.meta_whatsapp_campaign_recipients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  provider_message_id TEXT UNIQUE,
  direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text',
  text_body TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_messages_conversation
  ON public.meta_whatsapp_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_messages_status
  ON public.meta_whatsapp_messages(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_messages_campaign
  ON public.meta_whatsapp_messages(campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;

DROP TRIGGER IF EXISTS meta_whatsapp_conversations_updated_at ON public.meta_whatsapp_conversations;
CREATE TRIGGER meta_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.meta_whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

DROP TRIGGER IF EXISTS meta_whatsapp_messages_updated_at ON public.meta_whatsapp_messages;
CREATE TRIGGER meta_whatsapp_messages_updated_at
BEFORE UPDATE ON public.meta_whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

ALTER TABLE public.meta_whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'meta_whatsapp_conversations',
    'meta_whatsapp_messages'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'service_role_full_access_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        'service_role_full_access_' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.meta_whatsapp_conversations (
  sender_id,
  waba_id,
  phone_number_id,
  contact_phone,
  last_campaign_id,
  last_message_preview,
  last_message_at,
  last_inbound_at,
  customer_window_expires_at,
  unread_count,
  metadata
)
SELECT DISTINCT ON (e.sender_id, e.recipient_phone)
  e.sender_id,
  s.waba_id,
  s.phone_number_id,
  e.recipient_phone,
  e.campaign_id,
  COALESCE(
    e.payload->'text'->>'body',
    e.payload->'button'->>'text',
    e.payload->'interactive'->'button_reply'->>'title',
    e.event_status,
    'Mensagem recebida'
  ),
  e.received_at,
  e.received_at,
  e.received_at + INTERVAL '24 hours',
  1,
  jsonb_build_object('backfilled_from_events', true)
FROM public.meta_whatsapp_events e
JOIN public.meta_whatsapp_senders s ON s.id = e.sender_id
WHERE e.event_type = 'inbound_message'
  AND e.sender_id IS NOT NULL
  AND e.recipient_phone IS NOT NULL
ORDER BY e.sender_id, e.recipient_phone, e.received_at DESC
ON CONFLICT (sender_id, contact_phone) DO UPDATE
SET
  last_campaign_id = COALESCE(EXCLUDED.last_campaign_id, public.meta_whatsapp_conversations.last_campaign_id),
  last_message_preview = EXCLUDED.last_message_preview,
  last_message_at = GREATEST(
    COALESCE(public.meta_whatsapp_conversations.last_message_at, EXCLUDED.last_message_at),
    EXCLUDED.last_message_at
  ),
  last_inbound_at = GREATEST(
    COALESCE(public.meta_whatsapp_conversations.last_inbound_at, EXCLUDED.last_inbound_at),
    EXCLUDED.last_inbound_at
  ),
  customer_window_expires_at = GREATEST(
    COALESCE(public.meta_whatsapp_conversations.customer_window_expires_at, EXCLUDED.customer_window_expires_at),
    EXCLUDED.customer_window_expires_at
  ),
  updated_at = now();

INSERT INTO public.meta_whatsapp_messages (
  conversation_id,
  sender_id,
  campaign_id,
  recipient_id,
  provider_message_id,
  direction,
  message_type,
  text_body,
  status,
  payload,
  received_at,
  created_at
)
SELECT
  c.id,
  e.sender_id,
  e.campaign_id,
  e.recipient_id,
  e.provider_message_id,
  'inbound',
  COALESCE(e.event_status, 'message'),
  COALESCE(
    e.payload->'text'->>'body',
    e.payload->'button'->>'text',
    e.payload->'interactive'->'button_reply'->>'title',
    ''
  ),
  'received',
  e.payload,
  e.received_at,
  e.received_at
FROM public.meta_whatsapp_events e
JOIN public.meta_whatsapp_conversations c
  ON c.sender_id = e.sender_id
  AND c.contact_phone = e.recipient_phone
WHERE e.event_type = 'inbound_message'
  AND e.sender_id IS NOT NULL
  AND e.recipient_phone IS NOT NULL
ON CONFLICT (provider_message_id) DO NOTHING;

COMMENT ON TABLE public.meta_whatsapp_conversations IS
  'Caixa de entrada das respostas aos envios oficiais feitos pela Meta WhatsApp Cloud API.';

COMMENT ON TABLE public.meta_whatsapp_messages IS
  'Historico de mensagens manuais e recebidas dentro das conversas oficiais Meta WhatsApp.';
