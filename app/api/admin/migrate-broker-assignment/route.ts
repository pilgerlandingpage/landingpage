import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
    try {
        const supabase = createAdminClient()

        // Add assignment_type column
        const { error: err1 } = await supabase.rpc('exec_sql', {
            query: `ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'all';`
        })

        // Add assigned_page_slugs column
        const { error: err2 } = await supabase.rpc('exec_sql', {
            query: `ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assigned_page_slugs jsonb DEFAULT '[]'::jsonb;`
        })

        if (err1 || err2) {
            // Fallback: try direct SQL via postgrest
            console.log('RPC not available, trying alternative approach...')
            // The columns may already exist, try an update to verify
            const { error: testErr } = await supabase
                .from('virtual_brokers')
                .select('assignment_type, assigned_page_slugs')
                .limit(1)

            if (testErr) {
                return NextResponse.json({
                    success: false,
                    error: 'Columns do not exist yet. Please run the SQL manually in Supabase Dashboard.',
                    sql: [
                        "ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'all';",
                        "ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assigned_page_slugs jsonb DEFAULT '[]'::jsonb;"
                    ]
                })
            }

            return NextResponse.json({ success: true, message: 'Columns already exist.' })
        }

        return NextResponse.json({ success: true, message: 'Migration completed successfully.' })
    } catch (error) {
        console.error('Migration error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
