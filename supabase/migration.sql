-- =====================================================
-- PILGER LANDING PAGE PLATFORM - Database Schema
-- Execute this in the Supabase SQL Editor
-- =====================================================

-- Properties (luxury real estate listings)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  price DECIMAL,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_m2 DECIMAL,
  amenities TEXT[],
  images TEXT[],
  featured_image TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Agents (personality configs per page)
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  greeting_message TEXT DEFAULT 'Olá! 👋 Seja bem-vindo. Como posso ajudá-lo a encontrar o imóvel dos seus sonhos?',
  extraction_goals TEXT[] DEFAULT ARRAY['name', 'phone', 'email'],
  temperature DECIMAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Landing Pages (multi-page support with pixel configs)
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  meta_pixel_id TEXT,
  google_ads_id TEXT,
  google_analytics_id TEXT,
  tiktok_pixel_id TEXT,
  linkedin_pixel_id TEXT,
  hero_image_url TEXT,
  gallery_images TEXT[],
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  custom_css TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  primary_color TEXT DEFAULT '#c9a96e',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Visitors (Ghost Tracking - anonymous visitors)
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_cookie_id TEXT UNIQUE NOT NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  fbclid TEXT,
  gclid TEXT,
  detected_source TEXT DEFAULT 'Direct',
  country TEXT,
  city TEXT,
  region TEXT,
  first_visit_at TIMESTAMPTZ DEFAULT now(),
  last_visit_at TIMESTAMPTZ DEFAULT now(),
  page_views INTEGER DEFAULT 1,
  converted BOOLEAN DEFAULT false
);

-- Leads (captured from AI chat)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  funnel_stage TEXT DEFAULT 'visitor' CHECK (funnel_stage IN ('visitor', 'engaged', 'lead', 'qualified', 'converted')),
  lead_score INTEGER DEFAULT 0,
  ai_summary TEXT,
  acquired_via TEXT DEFAULT 'chat',
  country TEXT,
  city TEXT,
  state TEXT,
  is_vip BOOLEAN DEFAULT false,
  push_subscribed BOOLEAN DEFAULT false,
  whatsapp_sent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat History (AI conversation logs)
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Push Subscriptions (Web Push tokens)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Funnel Events (stage transitions for visualization)
CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Landing Page Automation Rules
CREATE TABLE IF NOT EXISTS lp_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('lead_created', 'time_delay', 'funnel_stage', 'vip_detected')),
  delay_minutes INTEGER DEFAULT 0,
  message_template TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Landing Page Message Queue
CREATE TABLE IF NOT EXISTS lp_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES lp_automation_rules(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  target_phone TEXT,
  target_name TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitors_cookie ON visitors(visitor_cookie_id);
CREATE INDEX IF NOT EXISTS idx_visitors_source ON visitors(detected_source);
CREATE INDEX IF NOT EXISTS idx_visitors_landing_page ON visitors(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_leads_landing_page ON leads(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_leads_funnel ON leads(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_chat_history_visitor ON chat_history(visitor_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_landing ON funnel_events(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_type ON funnel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lp_queue_status ON lp_message_queue(status);

-- Enable RLS on all new tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_message_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Landing pages: anyone can read published pages
CREATE POLICY "Public can read published landing pages" ON landing_pages FOR SELECT USING (status = 'published');
CREATE POLICY "Authenticated users manage landing pages" ON landing_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Visitors
CREATE POLICY "Anyone can insert visitors" ON visitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own visitor" ON visitors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users read visitors" ON visitors FOR SELECT TO authenticated USING (true);

-- Leads
CREATE POLICY "Anyone can insert leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leads" ON leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage leads" ON leads FOR SELECT TO authenticated USING (true);

-- Chat history
CREATE POLICY "Anyone can insert chat" ON chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users read chat" ON chat_history FOR SELECT TO authenticated USING (true);

-- Properties
CREATE POLICY "Public can read properties" ON properties FOR SELECT USING (true);
CREATE POLICY "Authenticated users manage properties" ON properties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AI Agents
CREATE POLICY "Public can read agents" ON ai_agents FOR SELECT USING (true);
CREATE POLICY "Authenticated users manage agents" ON ai_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Push subscriptions
CREATE POLICY "Anyone can insert push subs" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users read push subs" ON push_subscriptions FOR SELECT TO authenticated USING (true);

-- Funnel events
CREATE POLICY "Anyone can insert funnel events" ON funnel_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users read funnel events" ON funnel_events FOR SELECT TO authenticated USING (true);

-- Automation rules
CREATE POLICY "Authenticated users manage automation rules" ON lp_automation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read automation rules" ON lp_automation_rules FOR SELECT USING (true);

-- Message queue
CREATE POLICY "Authenticated users manage message queue" ON lp_message_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default app_config entries
INSERT INTO app_config (key, value, description) VALUES
  ('welcome_message_template', 'Olá {{name}}! 👋 Obrigado pelo seu interesse em {{property}}. Um de nossos consultores entrará em contato em breve. 🏠✨', 'Template da mensagem de boas-vindas WhatsApp')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description) VALUES
  ('realtor_phone', '', 'Telefone do corretor para alertas VIP')
ON CONFLICT (key) DO NOTHING;
