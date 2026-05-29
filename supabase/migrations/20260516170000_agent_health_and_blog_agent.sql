INSERT INTO public.app_config (key, value, description)
VALUES
  ('blog_agent_enabled', 'true', 'Ativa o agente de blog para gerar rascunhos automaticamente quando nao houver artigo em revisao.'),
  ('blog_agent_interval_hours', '168', 'Intervalo minimo, em horas, entre verificacoes automaticas do agente de blog.'),
  ('blog_agent_last_run_at', '', 'Ultima execucao concluida do agente de blog.'),
  ('blog_agent_last_started_at', '', 'Ultima execucao iniciada do agente de blog.'),
  ('blog_agent_last_error', '', 'Ultimo erro do agente de blog.'),
  ('blog_agent_last_error_at', '', 'Data/hora do ultimo erro do agente de blog.'),
  ('blog_agent_last_result', '', 'Resumo da ultima execucao do agente de blog.'),
  ('organic_report_agent_last_result', '', 'Resumo da ultima execucao do agente de relatorio organico.'),
  ('paid_report_agent_last_result', '', 'Resumo da ultima execucao do agente de relatorio pago.'),
  ('organic_social_sync_last_result', '', 'Resumo da ultima sincronizacao organica.'),
  ('marketing_publisher_last_result', '', 'Resumo da ultima checagem do publicador.'),
  ('agent_health_last_checked_at', '', 'Ultima verificacao manual da saude dos agentes.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
