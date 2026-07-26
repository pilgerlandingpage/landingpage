INSERT INTO public.app_config (key, value, description, updated_at)
VALUES (
  'self_assessment_audio_workflow_id',
  '',
  'ID do workflow do agente global que envia os audios de pos-relatorio do Perfil do Corretor Ideal.',
  now()
)
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
