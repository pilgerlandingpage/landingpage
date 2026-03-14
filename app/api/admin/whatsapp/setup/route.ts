import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const queries = [
        `CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_user_id uuid NOT NULL,
          instance_name text NOT NULL UNIQUE,
          instance_token text NOT NULL DEFAULT '',
          phone_number text,
          status text NOT NULL DEFAULT 'disconnected',
          connected_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_admin_user ON public.whatsapp_instances(admin_user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON public.whatsapp_instances(status)`,
        `ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_instances' AND policyname='admin_all_whatsapp') THEN
            CREATE POLICY "admin_all_whatsapp" ON public.whatsapp_instances FOR ALL USING (true) WITH CHECK (true);
          END IF;
        END $$`,
    ]

    const results = []
    for (const sql of queries) {
        let rpcError = null
        try { const res = await supabase.rpc('exec', { sql }); rpcError = res.error } catch { rpcError = null }
        // Try raw approach
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
                method: 'GET',
                headers: {
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
                }
            })
            results.push({ sql: sql.substring(0, 50), status: 'attempted' })
        } catch (e) {
            results.push({ sql: sql.substring(0, 50), error: String(e) })
        }
    }

    // Verify table exists
    const { data, error: verifyError } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .limit(1)

    if (verifyError) {
        return NextResponse.json({
            success: false,
            error: verifyError.message,
            hint: 'Execute o SQL abaixo manualmente no Supabase Dashboard > SQL Editor',
            sql: `CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
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
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_whatsapp" ON public.whatsapp_instances FOR ALL USING (true) WITH CHECK (true);`
        })
    }

    return NextResponse.json({
        success: true,
        message: 'Tabela whatsapp_instances verificada com sucesso!',
        count: data?.length || 0,
        results
    })
}
