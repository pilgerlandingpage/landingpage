INSERT INTO public.app_config (key, value, description, updated_at)
VALUES
  ('meta_whatsapp_editorial_blog_template_name', '', 'Nome do template oficial Meta usado para campanhas de blog publicadas.', now()),
  ('meta_whatsapp_editorial_news_template_name', '', 'Nome do template oficial Meta usado para campanhas de noticias publicadas.', now()),
  ('meta_whatsapp_property_followup_template_name', '', 'Nome do template oficial Meta usado para recomendacoes e follow-ups de imoveis.', now()),
  ('meta_whatsapp_editorial_default_sender_id', '', 'UUID opcional do remetente Meta sincronizado para campanhas editoriais.', now())
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;
