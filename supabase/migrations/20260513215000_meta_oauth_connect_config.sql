INSERT INTO public.app_config (key, value, description)
VALUES
  ('public_site_url', 'https://guilhermepilger.ai', 'URL publica usada nos callbacks OAuth.'),
  ('instagram_app_id', '', 'ID do aplicativo Instagram usado no Instagram Login.'),
  ('instagram_app_secret', '', 'Secret do aplicativo Instagram usado no Instagram Login.'),
  ('instagram_connected_at', '', 'Data da ultima conexao OAuth do Instagram.'),
  ('instagram_token_expires_in', '', 'Validade informada pelo token do Instagram.'),
  ('facebook_connected_at', '', 'Data da ultima conexao OAuth do Facebook Page.'),
  ('meta_facebook_page_name', '', 'Nome da pagina Facebook conectada.'),
  ('meta_instagram_username', '', 'Username Instagram retornado pela Page API.')
ON CONFLICT (key) DO NOTHING;
