INSERT INTO public.app_config (key, value, description)
VALUES
  ('blog_agent_schedule_day', '1', 'Dia da semana em que o agente de blog deve trabalhar: 0 domingo ate 6 sabado.'),
  ('blog_agent_schedule_date', '', 'Data inicial, no formato YYYY-MM-DD, a partir da qual o agente de blog pode trabalhar.'),
  ('blog_agent_schedule_time', '09:00', 'Horario de Brasilia em que o agente de blog pode iniciar a criacao do rascunho.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
