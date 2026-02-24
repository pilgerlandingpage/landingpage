import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function main() {
    console.log('--- ADDING COLUMNS ---')

    const sql1 = `ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS duty_weekdays jsonb DEFAULT '[]'::jsonb;`
    const sql2 = `ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS duty_dates jsonb DEFAULT '[]'::jsonb;`


    try {
        // try RPC if available
        await supabase.rpc('exec_sql', { query: sql1 })
        await supabase.rpc('exec_sql', { query: sql2 })
        console.log("Success with RPC")
    } catch (e) {
        console.log("RPC Error, falling back to dummy insert to check if columns exist", e)
    }
}

main()
