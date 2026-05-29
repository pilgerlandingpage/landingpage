INSERT INTO public.app_config (key, value, description)
VALUES
  ('marketing_publisher_agent_enabled', 'true', 'Ativa o publicador da fila editorial de marketing.'),
  ('marketing_publisher_autopilot', 'false', 'Permite que o publicador publique automaticamente conteudos aprovados e vencidos.'),
  ('marketing_publisher_interval_minutes', '10', 'Intervalo em minutos para checar a fila editorial.'),
  ('marketing_publisher_last_run_at', '', 'Ultima execucao concluida do publicador de conteudo.'),
  ('marketing_publisher_last_started_at', '', 'Ultima execucao iniciada do publicador de conteudo.'),
  ('marketing_publisher_last_error', '', 'Ultimo erro do publicador de conteudo.'),
  ('marketing_publisher_last_error_at', '', 'Data do ultimo erro do publicador de conteudo.')
ON CONFLICT (key) DO NOTHING;
