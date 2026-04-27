-- Amplia a auditoria para cobrir recuperacao/redefinicao de senha e links de acesso.

ALTER TABLE public.user_access_logs
  DROP CONSTRAINT IF EXISTS user_access_logs_event_type_check;

ALTER TABLE public.user_access_logs
  ADD CONSTRAINT user_access_logs_event_type_check CHECK (
    event_type IN (
      'login_success',
      'login_failed',
      'logout',
      'page_view',
      'session_ping',
      'password_recovery_requested',
      'password_recovery_matched',
      'password_recovery_not_found',
      'password_recovery_link_sent',
      'password_recovery_link_failed',
      'password_reset_link_sent',
      'first_access_link_sent',
      'password_reset_completed',
      'first_access_password_set'
    )
  );
