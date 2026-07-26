INSERT INTO public.message_templates (
  template_key,
  business_unit,
  channel,
  event_type,
  name,
  subject,
  body,
  variables,
  requires_opt_in,
  is_active,
  metadata
)
VALUES
  (
    'member_first_access_whatsapp',
    'education',
    'whatsapp',
    'member.first_access',
    'WhatsApp de primeiro acesso',
    NULL,
    'Pagamento aprovado, {nome}. Seu acesso ao {produto} foi liberado. Defina sua senha e entre na área de membros por aqui: {access_link}',
    '["nome","produto","access_link","member_area_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'member_first_access_email',
    'education',
    'email',
    'member.first_access',
    'E-mail de primeiro acesso',
    'Seu acesso à área de membros foi liberado',
    'Olá, {nome}. Seu acesso ao {produto} foi liberado. Para definir sua senha e acessar sua biblioteca, use este link: {access_link}',
    '["nome","produto","access_link","member_area_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"brevo-email"}'::jsonb
  )
ON CONFLICT (business_unit, channel, template_key)
DO UPDATE SET
  event_type = EXCLUDED.event_type,
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  requires_opt_in = EXCLUDED.requires_opt_in,
  is_active = EXCLUDED.is_active,
  metadata = public.message_templates.metadata || EXCLUDED.metadata,
  updated_at = now();
