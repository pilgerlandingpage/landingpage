-- Auditoria de acessos dos usuarios internos da plataforma.
-- A leitura/escrita acontece por rotas server-side usando service_role.

CREATE TABLE IF NOT EXISTS public.user_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  auth_user_id UUID,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'login_success',
      'login_failed',
      'logout',
      'page_view',
      'session_ping'
    )
  ),
  path TEXT,
  method TEXT,
  attempted_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  referrer TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_created
  ON public.user_access_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_created
  ON public.user_access_logs (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_event_created
  ON public.user_access_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_ip_created
  ON public.user_access_logs (ip_address, created_at DESC);

ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_access_logs'
      AND policyname = 'service_role_full_access_user_access_logs'
  ) THEN
    CREATE POLICY "service_role_full_access_user_access_logs"
      ON public.user_access_logs
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
