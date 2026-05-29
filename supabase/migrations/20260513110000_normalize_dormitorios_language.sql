CREATE OR REPLACE FUNCTION public.normalize_dormitorios_language(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(value, ''), '\mQUARTOS\M', 'DORMITÓRIOS', 'g'),
              '\mQuartos\M', 'Dormitórios', 'g'
            ),
            '\mquartos\M', 'dormitórios', 'g'
          ),
          '\mQUARTO\M', 'DORMITÓRIO', 'g'
        ),
        '\mQuarto\M', 'Dormitório', 'g'
      ),
      '\mquarto\M', 'dormitório', 'g'
    );
$$;

DO $$
BEGIN
  UPDATE public.properties
  SET
    title = public.normalize_dormitorios_language(title),
    description = NULLIF(public.normalize_dormitorios_language(description), ''),
    amenities = CASE
      WHEN amenities IS NULL THEN NULL
      ELSE ARRAY(
        SELECT public.normalize_dormitorios_language(item)
        FROM unnest(amenities) AS item
      )
    END,
    updated_at = now()
  WHERE
    title ~* '\mquartos?\M'
    OR description ~* '\mquartos?\M'
    OR EXISTS (
      SELECT 1
      FROM unnest(coalesce(amenities, ARRAY[]::text[])) AS item
      WHERE item ~* '\mquartos?\M'
    );

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'seo_title'
  ) THEN
    UPDATE public.properties
    SET seo_title = NULLIF(public.normalize_dormitorios_language(seo_title), '')
    WHERE seo_title ~* '\mquartos?\M';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'seo_description'
  ) THEN
    UPDATE public.properties
    SET seo_description = NULLIF(public.normalize_dormitorios_language(seo_description), '')
    WHERE seo_description ~* '\mquartos?\M';
  END IF;

  UPDATE public.landing_pages
  SET
    title = public.normalize_dormitorios_language(title),
    subtitle = NULLIF(public.normalize_dormitorios_language(subtitle), ''),
    description = NULLIF(public.normalize_dormitorios_language(description), ''),
    content = public.normalize_dormitorios_language(coalesce(content, '{}'::jsonb)::text)::jsonb,
    updated_at = now()
  WHERE
    title ~* '\mquartos?\M'
    OR subtitle ~* '\mquartos?\M'
    OR description ~* '\mquartos?\M'
    OR content::text ~* '\mquartos?\M';

  UPDATE public.ai_agents
  SET
    system_prompt = public.normalize_dormitorios_language(system_prompt),
    greeting_message = public.normalize_dormitorios_language(greeting_message),
    updated_at = now()
  WHERE
    system_prompt ~* '\mquartos?\M'
    OR greeting_message ~* '\mquartos?\M';

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_config'
  ) THEN
    UPDATE public.app_config
    SET value = public.normalize_dormitorios_language(value)
    WHERE value ~* '\mquartos?\M';
  END IF;
END $$;

DROP FUNCTION public.normalize_dormitorios_language(text);
