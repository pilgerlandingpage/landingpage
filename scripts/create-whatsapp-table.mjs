import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pxlxwjwlakallylewydk.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bHh3andsYWthbGx5bGV3eWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgzODA0OCwiZXhwIjoyMDg2NDE0MDQ4fQ.n8I0sq5SXlI5tAY97YSzoIxfCkQqmDbpZkWr3685TvU'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SQL = `
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  instance_name text NOT NULL UNIQUE,
  instance_token text NOT NULL DEFAULT '',
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_admin_user ON public.whatsapp_instances(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON public.whatsapp_instances(status);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_whatsapp" ON public.whatsapp_instances;
CREATE POLICY "admin_all_whatsapp" ON public.whatsapp_instances
  FOR ALL USING (true) WITH CHECK (true);
`

const { error } = await supabase.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: 'rpc not available' }))

if (error) {
  // Try via postgres REST
  console.log('Trying direct table check...')
  const { data, error: checkError } = await supabase.from('whatsapp_instances').select('id').limit(1)
  if (checkError) {
    console.error('Table does not exist and cannot create via RPC:', checkError.message)
    console.log('\n=== EXECUTE THIS SQL IN SUPABASE DASHBOARD > SQL Editor ===\n')
    console.log(SQL)
    console.log('\n=== END SQL ===\n')
  } else {
    console.log('✅ Table already exists! Records:', data?.length || 0)
  }
} else {
  console.log('✅ Table created successfully!')
}
