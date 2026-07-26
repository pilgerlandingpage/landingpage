INSERT INTO public.app_config (key, value, updated_at)
VALUES
  ('commerce_automation_enabled', 'true', now()),
  ('commerce_pix_pending_after_minutes', '10', now()),
  ('commerce_pix_expiring_before_minutes', '15', now()),
  ('commerce_checkout_lost_after_hours', '24', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES (
  'commerce',
  'Ecommerce',
  'Acompanhar pedidos, clientes, funil de checkout e automações comerciais dos produtos digitais',
  'produto_digital'
)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_pix_expires
  ON public.commerce_orders(pix_expires_at)
  WHERE pix_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_recovery
  ON public.commerce_orders(recovery_status, updated_at DESC);

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
    'checkout_payment_pending_email',
    'education',
    'email',
    'payment.pending',
    'E-mail de Pix pendente',
    'Seu Pix para {produto} ainda está aguardando pagamento',
    'Olá, {nome}. Seu pedido {numero_pedido} para acessar {produto} ainda está aguardando pagamento. Valor: {valor}. Para continuar, acesse: {checkout_url}',
    '["nome","produto","numero_pedido","valor","checkout_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"brevo-email"}'::jsonb
  ),
  (
    'checkout_abandoned_email',
    'education',
    'email',
    'checkout.abandoned',
    'E-mail de carrinho abandonado',
    'Você deixou o {produto} esperando no checkout',
    'Olá, {nome}. Você iniciou a compra de {produto}, mas não concluiu. Para retomar com segurança, use este link: {checkout_url}',
    '["nome","produto","checkout_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"brevo-email"}'::jsonb
  ),
  (
    'checkout_pix_expiring',
    'education',
    'whatsapp',
    'payment.pix_expiring',
    'Pix perto de vencer',
    NULL,
    'Oi {nome}, seu Pix do {produto} vence em breve ({pix_expira_em}). Se quiser garantir seu acesso, conclua por aqui: {checkout_url}',
    '["nome","produto","pix_expira_em","checkout_url"]'::jsonb,
    true,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'checkout_pix_expiring_email',
    'education',
    'email',
    'payment.pix_expiring',
    'E-mail de Pix perto de vencer',
    'Seu Pix do {produto} vence em breve',
    'Olá, {nome}. Seu Pix do pedido {numero_pedido} vence em {pix_expira_em}. Para concluir sua compra, acesse: {checkout_url}',
    '["nome","produto","numero_pedido","pix_expira_em","checkout_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"brevo-email"}'::jsonb
  ),
  (
    'checkout_pix_expired',
    'education',
    'whatsapp',
    'payment.pix_expired',
    'Pix vencido',
    NULL,
    'Oi {nome}, o Pix do {produto} venceu. Se ainda quiser garantir seu exemplar, gere um novo pagamento por aqui: {checkout_url}',
    '["nome","produto","checkout_url"]'::jsonb,
    true,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'checkout_pix_expired_email',
    'education',
    'email',
    'payment.pix_expired',
    'E-mail de Pix vencido',
    'Seu Pix do {produto} venceu',
    'Olá, {nome}. O Pix do pedido {numero_pedido} venceu. Para tentar novamente e acessar {produto}, use este link: {checkout_url}',
    '["nome","produto","numero_pedido","checkout_url"]'::jsonb,
    false,
    true,
    '{"sender_agent":"brevo-email"}'::jsonb
  )
ON CONFLICT (business_unit, channel, template_key) DO UPDATE SET
  event_type = EXCLUDED.event_type,
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  requires_opt_in = EXCLUDED.requires_opt_in,
  is_active = EXCLUDED.is_active,
  metadata = public.message_templates.metadata || EXCLUDED.metadata,
  updated_at = now();
