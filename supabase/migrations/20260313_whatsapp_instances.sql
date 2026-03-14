-- ═══════════════════════════════════════════════════════════════
-- Migração: whatsapp_instances + permissão RBAC
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela de instâncias WhatsApp (vinculada a admin_users)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  instance_token TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected','connecting','connected')),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índice para buscar instâncias por usuário
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user ON public.whatsapp_instances(admin_user_id);

-- 3. Permissão RBAC para WhatsApp
INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES ('whatsapp', 'WhatsApp', 'Gerenciar instâncias WhatsApp e conexões', 'comunicacao')
ON CONFLICT (module_key) DO NOTHING;

-- 4. RLS para whatsapp_instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Política: service role tem acesso total
CREATE POLICY "service_role_full_access" ON public.whatsapp_instances
  FOR ALL USING (true) WITH CHECK (true);
