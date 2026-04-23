-- Permissoes de configuracao para controle de Setores e Usuarios por tags

INSERT INTO public.admin_permissions (module_key, label, description, category)
VALUES
  ('settings_sectors', 'Setores', 'Gerenciar setores e suas permissoes de acesso', 'sistema'),
  ('settings_users', 'Usuarios', 'Gerenciar usuarios administrativos e vinculacao de setores', 'sistema')
ON CONFLICT (module_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Backfill: manter comportamento legado da Diretoria (antes era por regra fixa)
WITH diretoria_sectors AS (
  SELECT id
  FROM public.admin_sectors
  WHERE LOWER(COALESCE(name, '')) LIKE '%diretoria%'
),
settings_users_perm AS (
  SELECT id FROM public.admin_permissions WHERE module_key = 'settings_users' LIMIT 1
),
settings_sectors_perm AS (
  SELECT id FROM public.admin_permissions WHERE module_key = 'settings_sectors' LIMIT 1
)
INSERT INTO public.admin_sector_permissions (sector_id, permission_id)
SELECT ds.id, sup.id
FROM diretoria_sectors ds
CROSS JOIN settings_users_perm sup
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_sector_permissions asp
  WHERE asp.sector_id = ds.id
    AND asp.permission_id = sup.id
);

WITH diretoria_sectors AS (
  SELECT id
  FROM public.admin_sectors
  WHERE LOWER(COALESCE(name, '')) LIKE '%diretoria%'
),
settings_sectors_perm AS (
  SELECT id FROM public.admin_permissions WHERE module_key = 'settings_sectors' LIMIT 1
)
INSERT INTO public.admin_sector_permissions (sector_id, permission_id)
SELECT ds.id, ssp.id
FROM diretoria_sectors ds
CROSS JOIN settings_sectors_perm ssp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_sector_permissions asp
  WHERE asp.sector_id = ds.id
    AND asp.permission_id = ssp.id
);
