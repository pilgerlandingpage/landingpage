-- Event confirmation system
-- Creates a reusable event module for broker registrations, WhatsApp automation and check-in.

CREATE TABLE IF NOT EXISTS public.event_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  eyebrow TEXT,
  subtitle TEXT,
  description TEXT,
  content TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location_name TEXT,
  location_address TEXT,
  format TEXT NOT NULL DEFAULT 'presencial' CHECK (format IN ('presencial', 'online', 'hibrido')),
  hero_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  capacity INTEGER,
  max_companions INTEGER NOT NULL DEFAULT 0,
  target_audience TEXT,
  agenda JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmation_message_template TEXT,
  reminder_message_template TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  broker_type TEXT NOT NULL DEFAULT 'autonomo' CHECK (broker_type IN ('autonomo', 'imobiliaria')),
  real_estate_name TEXT,
  creci TEXT,
  creci_state TEXT,
  city TEXT,
  market_focus TEXT,
  monthly_leads TEXT,
  consent_whatsapp BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'checked_in', 'waitlisted')),
  creci_status TEXT NOT NULL DEFAULT 'pending' CHECK (creci_status IN ('pending', 'manually_verified', 'rejected')),
  source TEXT,
  checkin_code TEXT NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('immediate', 'before_event', 'at_event_time', 'after_event', 'fixed_datetime')),
  offset_minutes INTEGER NOT NULL DEFAULT 0,
  fixed_datetime TIMESTAMPTZ,
  segment TEXT NOT NULL DEFAULT 'all' CHECK (segment IN ('all', 'autonomos', 'imobiliarias', 'creci_pending', 'creci_verified')),
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event_events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.event_automation_rules(id) ON DELETE SET NULL,
  target_phone TEXT NOT NULL,
  target_name TEXT,
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  provider_response JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.event_events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.event_registrations(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.event_automation_rules(id) ON DELETE SET NULL,
  message_queue_id UUID REFERENCES public.event_message_queue(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  action TEXT NOT NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_events_status_date ON public.event_events(status, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_events_slug ON public.event_events(slug);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_registrations_phone ON public.event_registrations(event_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_unique_phone ON public.event_registrations(event_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_checkin_code ON public.event_registrations(checkin_code);
CREATE INDEX IF NOT EXISTS idx_event_rules_event_active ON public.event_automation_rules(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_event_queue_due ON public.event_message_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_event_logs_event ON public.event_agent_logs(event_id, created_at DESC);

ALTER TABLE public.event_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published events" ON public.event_events;
DROP POLICY IF EXISTS "Authenticated users manage events" ON public.event_events;
DROP POLICY IF EXISTS "Authenticated users manage event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Authenticated users manage event automation rules" ON public.event_automation_rules;
DROP POLICY IF EXISTS "Authenticated users manage event message queue" ON public.event_message_queue;
DROP POLICY IF EXISTS "Authenticated users read event agent logs" ON public.event_agent_logs;

CREATE POLICY "Public can read published events"
  ON public.event_events FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authenticated users manage events"
  ON public.event_events FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users manage event registrations"
  ON public.event_registrations FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users manage event automation rules"
  ON public.event_automation_rules FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users manage event message queue"
  ON public.event_message_queue FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users read event agent logs"
  ON public.event_agent_logs FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES ('events', 'Eventos', 'Criar eventos, acompanhar inscritos e controlar automacoes de confirmacao', 'marketing')
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

WITH seeded_event AS (
  INSERT INTO public.event_events (
    title,
    slug,
    eyebrow,
    subtitle,
    description,
    content,
    event_date,
    location_name,
    location_address,
    format,
    hero_image_url,
    status,
    capacity,
    target_audience,
    confirmation_message_template,
    reminder_message_template,
    metadata
  )
  VALUES (
    'Encontro para corretores que querem operar com mais inteligencia.',
    'encontro-corretores-pilger',
    'Encontro estrategico para corretores',
    'Uma apresentacao reservada para profissionais que querem conhecer uma novidade antes dela chegar ao discurso comum do mercado.',
    'Convite editorial para corretores de imoveis, autonomos e equipes comerciais de imobiliarias.',
    'O mercado imobiliario esta entrando em uma nova fase: mais dados, mais velocidade, mais precisao e menos espaco para operacoes improvisadas.

Este encontro foi desenhado para corretores que querem conhecer uma novidade antes dela chegar ao discurso comum do mercado.

A proposta e reunir profissionais selecionados, apresentar uma visao pratica e abrir uma conversa direta sobre captacao, atendimento e conversao.',
    '2026-05-21 16:00:00-03'::timestamptz,
    'Guilherme Pilger - Praia Brava',
    'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Balneario Camboriu - SC, 88306-800',
    'presencial',
    'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/portobelo.png',
    'published',
    120,
    'Corretores de imoveis, autonomos e equipes comerciais de imobiliarias.',
    'Ola {nome}, sua presenca no encontro "{evento}" esta confirmada.

Data: {data_evento}
Local: {local_evento}

Vamos apresentar uma novidade estrategica para corretores que querem operar com mais inteligencia no mercado imobiliario.

Equipe Guilherme Pilger',
    'Ola {nome}, passando para lembrar do nosso encontro "{evento}".

Comeca em {data_evento}.
Local: {local_evento}

Estamos te esperando.',
    '{"seeded": true, "agent": "eventos_guilherme_pilger", "maps_url": "https://maps.app.goo.gl/GoMP8dNm3iHVkDKN6"}'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, confirmation_message_template, reminder_message_template
)
INSERT INTO public.event_automation_rules (
  event_id,
  name,
  trigger_type,
  offset_minutes,
  segment,
  message_template,
  is_active
)
SELECT id, 'Confirmacao imediata', 'immediate', 0, 'all', confirmation_message_template, true
FROM seeded_event
UNION ALL
SELECT id, 'Lembrete 5 horas antes', 'before_event', 300, 'all', reminder_message_template, true
FROM seeded_event
UNION ALL
SELECT id, 'Mensagem na hora do evento', 'at_event_time', 0, 'all', 'Ola {nome}, o encontro "{evento}" comeca agora. Estamos te esperando no {local_evento}.', false
FROM seeded_event;
