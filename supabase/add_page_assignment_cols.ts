// Run this script to add the new columns to virtual_brokers
// Usage: npx tsx supabase/add_page_assignment_cols.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxlxwjwlakallylewydk.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseServiceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    console.log('--- Adding assignment columns to virtual_brokers ---')

    // Test if columns already exist
    const { data, error } = await supabase
        .from('virtual_brokers')
        .select('assignment_type, assigned_page_slugs')
        .limit(1)

    if (!error) {
        console.log('✅ Columns already exist! No migration needed.')
        return
    }

    console.log('Columns do not exist yet. Error:', error.message)
    console.log('')
    console.log('Please run the following SQL in your Supabase Dashboard SQL Editor:')
    console.log('')
    console.log("ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'all';")
    console.log("ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS assigned_page_slugs jsonb DEFAULT '[]'::jsonb;")
    console.log('')
    console.log('Go to: https://supabase.com/dashboard/project/pxlxwjwlakallylewydk/sql/new')
}

main()
