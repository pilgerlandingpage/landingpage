CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_properties_active_location_geom
  ON public.properties
  USING GIST (
    ST_SetSRID(ST_MakePoint(longitude::DOUBLE PRECISION, latitude::DOUBLE PRECISION), 4326)
  )
  WHERE status = 'active'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_active_properties_in_area(
  p_draw_area JSONB DEFAULT NULL,
  p_bounds JSONB DEFAULT NULL
)
RETURNS SETOF public.properties
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  draw_geometry geometry;
  bounds_geometry geometry;
  north DOUBLE PRECISION;
  south DOUBLE PRECISION;
  east DOUBLE PRECISION;
  west DOUBLE PRECISION;
BEGIN
  IF p_draw_area IS NOT NULL
    AND jsonb_typeof(p_draw_area) = 'array'
    AND jsonb_array_length(p_draw_area) >= 3
  THEN
    WITH valid_points AS (
      SELECT
        item.ordinality::INTEGER AS ordinal,
        (item.value->>0)::DOUBLE PRECISION AS lat,
        (item.value->>1)::DOUBLE PRECISION AS lng
      FROM jsonb_array_elements(p_draw_area) WITH ORDINALITY AS item(value, ordinality)
      WHERE jsonb_typeof(item.value) = 'array'
        AND jsonb_array_length(item.value) >= 2
        AND (item.value->>0) ~ '^-?[0-9]+(\.[0-9]+)?$'
        AND (item.value->>1) ~ '^-?[0-9]+(\.[0-9]+)?$'
        AND (item.value->>0)::DOUBLE PRECISION BETWEEN -90 AND 90
        AND (item.value->>1)::DOUBLE PRECISION BETWEEN -180 AND 180
    ),
    first_point AS (
      SELECT lng, lat FROM valid_points ORDER BY ordinal LIMIT 1
    ),
    closed_points AS (
      SELECT ordinal, lng, lat FROM valid_points
      UNION ALL
      SELECT 2147483647 AS ordinal, lng, lat FROM first_point
    ),
    geojson AS (
      SELECT jsonb_build_object(
        'type',
        'Polygon',
        'coordinates',
        jsonb_build_array(jsonb_agg(jsonb_build_array(lng, lat) ORDER BY ordinal))
      )::TEXT AS value
      FROM closed_points
      HAVING COUNT(*) >= 4
    )
    SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(value), 4326))
      INTO draw_geometry
    FROM geojson;
  END IF;

  IF p_bounds IS NOT NULL AND jsonb_typeof(p_bounds) = 'object' THEN
    north := NULLIF(p_bounds->>'north', '')::DOUBLE PRECISION;
    south := NULLIF(p_bounds->>'south', '')::DOUBLE PRECISION;
    east := NULLIF(p_bounds->>'east', '')::DOUBLE PRECISION;
    west := NULLIF(p_bounds->>'west', '')::DOUBLE PRECISION;

    IF north BETWEEN -90 AND 90
      AND south BETWEEN -90 AND 90
      AND east BETWEEN -180 AND 180
      AND west BETWEEN -180 AND 180
      AND north > south
      AND east > west
    THEN
      bounds_geometry := ST_MakeEnvelope(west, south, east, north, 4326);
    END IF;
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.properties p
  WHERE p.status = 'active'
    AND (
      draw_geometry IS NULL
      OR (
        p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND ST_Covers(
          draw_geometry,
          ST_SetSRID(ST_MakePoint(p.longitude::DOUBLE PRECISION, p.latitude::DOUBLE PRECISION), 4326)
        )
      )
    )
    AND (
      bounds_geometry IS NULL
      OR (
        p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND ST_Covers(
          bounds_geometry,
          ST_SetSRID(ST_MakePoint(p.longitude::DOUBLE PRECISION, p.latitude::DOUBLE PRECISION), 4326)
        )
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_active_properties_in_area(JSONB, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.search_active_properties_in_area(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_active_properties_in_area(JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION public.search_active_properties_in_area(JSONB, JSONB)
  IS 'Returns active properties inside a drawn map polygon and/or map bounds for Zillow-like server-side map search.';
