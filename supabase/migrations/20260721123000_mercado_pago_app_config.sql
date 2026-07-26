INSERT INTO public.app_config (key, value, description, updated_at)
VALUES
  ('mercado_pago_enabled', 'false', 'Ativa ou desativa a integração de pagamentos do Mercado Pago no comércio digital.', NOW()),
  ('mercado_pago_environment', 'sandbox', 'Ambiente usado pelo Mercado Pago: sandbox para testes ou production para vendas reais.', NOW()),
  ('mercado_pago_public_key', '', 'Public Key do Mercado Pago. Pode ser usada no frontend do checkout.', NOW()),
  ('mercado_pago_access_token', '', 'Access Token privado do Mercado Pago. Deve ser usado apenas no backend.', NOW()),
  ('mercado_pago_webhook_secret', '', 'Segredo usado para validar a assinatura dos webhooks de pagamento do Mercado Pago.', NOW()),
  ('mercado_pago_webhook_url', 'https://guilhermepilger.ai/api/webhooks/mercadopago', 'URL pública que receberá os webhooks de pagamento do Mercado Pago.', NOW()),
  ('mercado_pago_pix_expiration_minutes', '60', 'Prazo de expiração do Pix gerado no checkout, em minutos.', NOW()),
  ('mercado_pago_statement_descriptor', 'PILGER', 'Nome curto exibido na fatura quando o pagamento permitir descriptor.', NOW()),
  ('commerce_member_area_url', 'https://guilhermepilger.ai/membros', 'URL pública da área de membros que entrega os produtos digitais comprados.', NOW()),
  ('commerce_support_whatsapp', '', 'WhatsApp de suporte para mensagens transacionais e recuperação de compra.', NOW()),
  ('commerce_checkout_abandoned_after_minutes', '30', 'Tempo até classificar um checkout iniciado como carrinho abandonado.', NOW()),
  ('commerce_whatsapp_notifications_enabled', 'true', 'Permite que o WhatsApp Global envie mensagens transacionais do comércio digital.', NOW()),
  ('commerce_email_notifications_enabled', 'true', 'Permite envio de e-mails transacionais do comércio digital pela integração de e-mail.', NOW())
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  value = CASE
    WHEN COALESCE(public.app_config.value, '') = '' THEN EXCLUDED.value
    ELSE public.app_config.value
  END,
  updated_at = NOW();
