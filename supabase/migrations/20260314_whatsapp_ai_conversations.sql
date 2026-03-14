-- ═══════════════════════════════════════════════════════════════
-- Migração: Tabelas de Conversas WhatsApp IA + Atualizações
-- ═══════════════════════════════════════════════════════════════

-- 1. Coluna whatsapp_instance_id em virtual_brokers
ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

-- 2. Colunas de IA por corretor
ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- 3. Coluna broker_id em whatsapp_instances (vínculo reverso)
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES public.virtual_brokers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_broker ON public.whatsapp_instances(broker_id);

-- 4. Tabela de conversas do Agente IA com Lead
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  broker_id UUID NOT NULL REFERENCES public.virtual_brokers(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  lead_phone TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  lead_data_extracted JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'closed')),
  transferred_to_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_broker ON public.whatsapp_ai_conversations(broker_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_lead_phone ON public.whatsapp_ai_conversations(lead_phone);
CREATE INDEX IF NOT EXISTS idx_ai_conv_status ON public.whatsapp_ai_conversations(status);

-- 5. Tabela de conversas do Corretor Humano com Lead
CREATE TABLE IF NOT EXISTS public.whatsapp_broker_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  broker_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  ai_conversation_id UUID REFERENCES public.whatsapp_ai_conversations(id) ON DELETE SET NULL,
  lead_phone TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  is_shadow_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_conv_user ON public.whatsapp_broker_conversations(broker_user_id);
CREATE INDEX IF NOT EXISTS idx_broker_conv_ai ON public.whatsapp_broker_conversations(ai_conversation_id);

-- 6. Colunas de Agente Sombra em admin_users
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS shadow_agent_prompt TEXT,
  ADD COLUMN IF NOT EXISTS shadow_agent_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_from TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS available_until TIME DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

-- 7. RLS para novas tabelas
ALTER TABLE public.whatsapp_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON public.whatsapp_ai_conversations
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.whatsapp_broker_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON public.whatsapp_broker_conversations
  FOR ALL USING (true) WITH CHECK (true);
