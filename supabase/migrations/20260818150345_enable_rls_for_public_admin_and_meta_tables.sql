-- Enable RLS for public tables flagged by Supabase Advisor.
-- Application access to these records should stay behind verified server APIs.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_permissions',
    'admin_sectors',
    'admin_sector_permissions',
    'meta_social_comments'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND policyname = 'service_role_full_access_' || tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
          'service_role_full_access_' || tbl,
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;
