INSERT INTO public.app_config (key, value, description)
VALUES
  ('organic_report_agent_interval_hours', '24', 'Intervalo minimo, em horas, entre relatorios automaticos do agente organico.'),
  ('organic_report_agent_last_run_at', '', 'Ultimo relatorio organico gerado automaticamente.'),
  ('organic_report_agent_last_started_at', '', 'Ultima tentativa de gerar relatorio organico automaticamente.'),
  ('organic_report_agent_last_error', '', 'Ultimo erro do agente de relatorio organico.'),
  ('organic_report_agent_last_error_at', '', 'Data/hora do ultimo erro do agente de relatorio organico.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
