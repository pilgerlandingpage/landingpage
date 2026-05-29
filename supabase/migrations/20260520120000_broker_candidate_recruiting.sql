-- Broker candidate recruiting module
-- Public "Trabalhe Conosco" registrations, WhatsApp message automations and agent logs.

CREATE TABLE IF NOT EXISTS public.broker_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  phone_normalized TEXT,
  broker_type TEXT NOT NULL DEFAULT 'autonomo' CHECK (broker_type IN ('autonomo', 'imobiliaria', 'equipe')),
  creci TEXT,
  creci_state TEXT,
  city TEXT,
  state TEXT,
  current_company TEXT,
  experience_years INTEGER,
  market_focus TEXT[] NOT NULL DEFAULT '{}'::text[],
  regions TEXT[] NOT NULL DEFAULT '{}'::text[],
  specialties TEXT[] NOT NULL DEFAULT '{}'::text[],
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'potential', 'approved', 'rejected', 'contacted', 'archived')),
  potential_score INTEGER NOT NULL DEFAULT 0,
  potential_level TEXT NOT NULL DEFAULT 'cold' CHECK (potential_level IN ('hot', 'warm', 'review', 'cold')),
  ai_summary TEXT,
  ai_recommendation TEXT,
  consent_whatsapp BOOLEAN NOT NULL DEFAULT false,
  consent_data_processing BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_candidates_phone_unique
  ON public.broker_candidates(phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

CREATE INDEX IF NOT EXISTS idx_broker_candidates_status_created ON public.broker_candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_candidates_score ON public.broker_candidates(potential_score DESC);
CREATE INDEX IF NOT EXISTS idx_broker_candidates_visitor ON public.broker_candidates(visitor_id);
CREATE INDEX IF NOT EXISTS idx_broker_candidates_social_links ON public.broker_candidates USING gin(social_links);
CREATE INDEX IF NOT EXISTS idx_broker_candidates_metadata ON public.broker_candidates USING gin(metadata);

CREATE TABLE IF NOT EXISTS public.broker_candidate_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'immediate' CHECK (trigger_type IN ('immediate', 'after_signup', 'status_changed', 'high_potential', 'return_visit', 'fixed_datetime', 'manual')),
  offset_minutes INTEGER NOT NULL DEFAULT 0,
  fixed_datetime TIMESTAMPTZ,
  segment TEXT NOT NULL DEFAULT 'all' CHECK (segment IN ('all', 'high_potential', 'medium_potential', 'low_potential', 'creci_informed', 'creci_missing', 'returning_visitors', 'new', 'in_review', 'potential', 'approved', 'rejected', 'contacted')),
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_candidate_rules_active ON public.broker_candidate_automation_rules(is_active, trigger_type);
CREATE INDEX IF NOT EXISTS idx_broker_candidate_rules_segment ON public.broker_candidate_automation_rules(segment);

CREATE TABLE IF NOT EXISTS public.broker_candidate_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.broker_candidates(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.broker_candidate_automation_rules(id) ON DELETE SET NULL,
  target_phone TEXT NOT NULL,
  target_name TEXT,
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  provider_response JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_candidate_queue_due ON public.broker_candidate_message_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_broker_candidate_queue_candidate ON public.broker_candidate_message_queue(candidate_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_broker_candidate_queue_rule ON public.broker_candidate_message_queue(rule_id);

CREATE TABLE IF NOT EXISTS public.broker_candidate_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.broker_candidates(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.broker_candidate_automation_rules(id) ON DELETE SET NULL,
  message_queue_id UUID REFERENCES public.broker_candidate_message_queue(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  action TEXT NOT NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_candidate_logs_candidate ON public.broker_candidate_agent_logs(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_candidate_logs_action ON public.broker_candidate_agent_logs(action, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_broker_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_candidates_updated_at ON public.broker_candidates;
CREATE TRIGGER broker_candidates_updated_at
BEFORE UPDATE ON public.broker_candidates
FOR EACH ROW EXECUTE FUNCTION public.update_broker_candidates_updated_at();

DROP TRIGGER IF EXISTS broker_candidate_rules_updated_at ON public.broker_candidate_automation_rules;
CREATE TRIGGER broker_candidate_rules_updated_at
BEFORE UPDATE ON public.broker_candidate_automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_broker_candidates_updated_at();

ALTER TABLE public.broker_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_candidate_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_candidate_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_candidate_agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage broker candidates" ON public.broker_candidates;
CREATE POLICY "Authenticated users manage broker candidates"
  ON public.broker_candidates FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage broker candidate automation rules" ON public.broker_candidate_automation_rules;
CREATE POLICY "Authenticated users manage broker candidate automation rules"
  ON public.broker_candidate_automation_rules FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage broker candidate queue" ON public.broker_candidate_message_queue;
CREATE POLICY "Authenticated users manage broker candidate queue"
  ON public.broker_candidate_message_queue FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users read broker candidate logs" ON public.broker_candidate_agent_logs;
CREATE POLICY "Authenticated users read broker candidate logs"
  ON public.broker_candidate_agent_logs FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES ('broker_candidates', 'Trabalhe Conosco', 'Acompanhar candidatos corretores, mensagens e inteligencia de recrutamento', 'comercial')
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

INSERT INTO public.broker_candidate_automation_rules (
  name,
  trigger_type,
  offset_minutes,
  segment,
  message_template,
  is_active,
  metadata
)
VALUES
(
  'Boas-vindas apos cadastro',
  'immediate',
  0,
  'all',
  'Ola {nome}, recebemos seu cadastro para trabalhar com a Pilger.\n\nNosso agente de recrutamento vai analisar seu perfil profissional e nossa equipe acompanha a proxima etapa pelo painel.\n\nEnquanto isso, continue acompanhando nosso ecossistema: {link_trabalhe_conosco}',
  true,
  '{"source":"broker-candidate-office","interaction_type":"none","tracking_enabled":true,"tracking_tag":"broker_candidate_welcome"}'::jsonb
),
(
  'Follow-up alto potencial',
  'high_potential',
  1440,
  'high_potential',
  'Ola {nome}, seu perfil chamou atencao da nossa equipe.\n\nQueremos entender melhor sua atuacao em {cidade} e seu momento profissional. Pode me responder por aqui qual tipo de imovel ou cliente voce mais atende hoje?',
  true,
  '{"source":"broker-candidate-office","interaction_type":"none","tracking_enabled":true,"tracking_tag":"broker_candidate_hot_followup"}'::jsonb
)
ON CONFLICT DO NOTHING;
