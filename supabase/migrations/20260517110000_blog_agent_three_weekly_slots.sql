INSERT INTO public.app_config (key, value, description)
VALUES
  ('blog_agent_schedule_day_1', '1', 'Primeiro dia semanal do agente de blog: 0 domingo ate 6 sabado.'),
  ('blog_agent_schedule_time_1', '09:00', 'Primeiro horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_2', '3', 'Segundo dia semanal do agente de blog: 0 domingo ate 6 sabado.'),
  ('blog_agent_schedule_time_2', '09:00', 'Segundo horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_3', '5', 'Terceiro dia semanal do agente de blog: 0 domingo ate 6 sabado.'),
  ('blog_agent_schedule_time_3', '09:00', 'Terceiro horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_4', 'off', 'Quarto dia semanal do agente de blog; off quando desativado.'),
  ('blog_agent_schedule_time_4', '09:00', 'Quarto horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_5', 'off', 'Quinto dia semanal do agente de blog; off quando desativado.'),
  ('blog_agent_schedule_time_5', '09:00', 'Quinto horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_6', 'off', 'Sexto dia semanal do agente de blog; off quando desativado.'),
  ('blog_agent_schedule_time_6', '09:00', 'Sexto horario semanal do agente de blog em Brasilia.'),
  ('blog_agent_schedule_day_7', 'off', 'Setimo dia semanal do agente de blog; off quando desativado.'),
  ('blog_agent_schedule_time_7', '09:00', 'Setimo horario semanal do agente de blog em Brasilia.')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
