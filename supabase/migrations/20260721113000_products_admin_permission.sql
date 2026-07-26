INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES (
  'products',
  'Produtos Digitais',
  'Gerenciar produtos, ofertas, conteúdos e order bumps da plataforma de educação',
  'produto_digital'
)
ON CONFLICT (module_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
