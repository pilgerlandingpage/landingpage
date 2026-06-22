-- WhatsApp attendance monitor: contacts, chats, raw messages and daily coaching reports.

CREATE TABLE IF NOT EXISTS public.whatsapp_instance_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  jid TEXT NOT NULL,
  phone TEXT,
  contact_name TEXT,
  first_name TEXT,
  raw JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instance_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_contacts_instance ON public.whatsapp_instance_contacts(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_contacts_phone ON public.whatsapp_instance_contacts(phone);

CREATE TABLE IF NOT EXISTS public.whatsapp_instance_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  phone TEXT,
  chat_name TEXT,
  is_group BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ,
  raw JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instance_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_chats_instance ON public.whatsapp_instance_chats(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_chats_phone ON public.whatsapp_instance_chats(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_chats_last_message ON public.whatsapp_instance_chats(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  phone TEXT,
  direction TEXT DEFAULT 'unknown' CHECK (direction IN ('inbound', 'outbound', 'unknown')),
  from_me BOOLEAN DEFAULT false,
  author_type TEXT DEFAULT 'unknown' CHECK (author_type IN ('lead', 'broker', 'agent', 'unknown')),
  sender_name TEXT,
  message_type TEXT,
  body TEXT,
  message_timestamp TIMESTAMPTZ,
  source TEXT DEFAULT 'uazapi',
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instance_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_instance ON public.whatsapp_message_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_chat ON public.whatsapp_message_history(instance_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_phone ON public.whatsapp_message_history(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_timestamp ON public.whatsapp_message_history(message_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_import_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'attendance_snapshot',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  summary JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_import_jobs_instance ON public.whatsapp_import_jobs(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_import_jobs_created ON public.whatsapp_import_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.broker_attendance_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  report_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  title TEXT,
  summary TEXT,
  coverage JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instance_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_reports_date ON public.broker_attendance_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_broker_attendance_reports_instance ON public.broker_attendance_reports(instance_id);

CREATE TABLE IF NOT EXISTS public.broker_attendance_conversation_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.broker_attendance_reports(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  chat_id TEXT NOT NULL,
  phone TEXT,
  lead_name TEXT,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  lead_potential TEXT DEFAULT 'unknown' CHECK (lead_potential IN ('hot', 'warm', 'cold', 'unknown')),
  response_time_seconds INTEGER,
  unanswered BOOLEAN DEFAULT false,
  summary TEXT,
  risks JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (report_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_attendance_scores_report ON public.broker_attendance_conversation_scores(report_id);
CREATE INDEX IF NOT EXISTS idx_broker_attendance_scores_instance ON public.broker_attendance_conversation_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_broker_attendance_scores_phone ON public.broker_attendance_conversation_scores(phone);

ALTER TABLE public.whatsapp_instance_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instance_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_attendance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_attendance_conversation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.whatsapp_instance_contacts
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.whatsapp_instance_chats
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.whatsapp_message_history
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.whatsapp_import_jobs
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.broker_attendance_reports
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access" ON public.broker_attendance_conversation_scores
  FOR ALL USING (true) WITH CHECK (true);
