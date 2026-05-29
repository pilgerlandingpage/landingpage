INSERT INTO public.app_config (key, value, description)
VALUES
  ('paid_report_agent_interval_hours', '24', 'Intervalo minimo, em horas, entre relatorios automaticos do agente pago.'),
  ('paid_report_agent_last_run_at', '', 'Ultimo relatorio pago gerado automaticamente.'),
  ('paid_report_agent_last_started_at', '', 'Ultima tentativa de gerar relatorio pago automaticamente.'),
  ('paid_report_agent_last_error', '', 'Ultimo erro do agente de relatorio pago.'),
  ('paid_report_agent_last_error_at', '', 'Data/hora do ultimo erro do agente de relatorio pago.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
