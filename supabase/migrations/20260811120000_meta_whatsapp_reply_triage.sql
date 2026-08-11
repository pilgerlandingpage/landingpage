CREATE TABLE IF NOT EXISTS public.meta_whatsapp_reply_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.meta_whatsapp_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.meta_whatsapp_messages(id) ON DELETE SET NULL,
  event_id UUID UNIQUE REFERENCES public.meta_whatsapp_events(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.meta_whatsapp_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.meta_whatsapp_campaign_recipients(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.meta_whatsapp_senders(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  provider_message_id TEXT,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  intent TEXT NOT NULL
    CHECK (intent IN ('interested', 'opt_out', 'question', 'unknown')),
  confidence INTEGER NOT NULL DEFAULT 100
    CHECK (confidence >= 0 AND confidence <= 100),
  source TEXT NOT NULL DEFAULT 'keyword'
    CHECK (source IN ('button', 'keyword', 'manual', 'system')),
  button_text TEXT,
  button_payload TEXT,
  raw_text TEXT,
  campaign_name TEXT,
  template_name TEXT,
  auto_reply_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (auto_reply_status IN ('pending', 'sent', 'skipped', 'failed')),
  auto_reply_message TEXT,
  auto_reply_error TEXT,
  notified_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notified_status IN ('pending', 'sent', 'skipped', 'failed')),
  notified_phone TEXT,
  notified_at TIMESTAMPTZ,
  notified_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_whatsapp_reply_intents_provider_message
  ON public.meta_whatsapp_reply_intents(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_reply_intents_intent
  ON public.meta_whatsapp_reply_intents(intent, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_reply_intents_campaign
  ON public.meta_whatsapp_reply_intents(campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_reply_intents_contact
  ON public.meta_whatsapp_reply_intents(contact_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_reply_intents_conversation
  ON public.meta_whatsapp_reply_intents(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

DROP TRIGGER IF EXISTS meta_whatsapp_reply_intents_updated_at ON public.meta_whatsapp_reply_intents;
CREATE TRIGGER meta_whatsapp_reply_intents_updated_at
BEFORE UPDATE ON public.meta_whatsapp_reply_intents
FOR EACH ROW EXECUTE FUNCTION public.update_meta_whatsapp_updated_at();

ALTER TABLE public.meta_whatsapp_reply_intents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meta_whatsapp_reply_intents'
      AND policyname = 'service_role_full_access_meta_whatsapp_reply_intents'
  ) THEN
    CREATE POLICY service_role_full_access_meta_whatsapp_reply_intents
      ON public.meta_whatsapp_reply_intents
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

INSERT INTO public.app_config(key, value, description) VALUES
  ('meta_whatsapp_triage_enabled', 'true', 'Ativa a triagem automatica das respostas recebidas nas campanhas oficiais Meta WhatsApp.'),
  ('meta_whatsapp_triage_interest_notify_phone', '', 'Numero interno que recebe alerta quando um lead demonstra interesse em uma campanha Meta WhatsApp.'),
  ('meta_whatsapp_triage_interest_reply', 'Perfeito. Vou encaminhar seu contato para um especialista da nossa equipe dar continuidade ao atendimento.', 'Resposta automatica enviada quando o lead pede mais informacoes.'),
  ('meta_whatsapp_triage_opt_out_reply', 'Pronto. Removemos seu contato da nossa lista. Voce nao recebera novas campanhas por este canal.', 'Resposta automatica enviada quando o lead pede para sair da lista.'),
  ('meta_whatsapp_triage_privacy_reply', 'Voce estava em nossa base de contatos de campanhas anteriores da imobiliaria. Se quiser sair da lista, responda SAIR que removemos seu contato.', 'Resposta automatica para perguntas sobre origem do contato.')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.meta_whatsapp_reply_intents IS
  'Classificacao operacional das respostas recebidas em campanhas oficiais Meta WhatsApp, incluindo interesses e opt-outs.';
