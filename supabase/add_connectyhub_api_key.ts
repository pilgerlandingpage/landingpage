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
    console.log('--- ADDING CONNECTYHUB API KEY COLUMN TO VIRTUAL BROKERS ---')

    // Attempt via RPC
    const sql = `ALTER TABLE public.virtual_brokers ADD COLUMN IF NOT EXISTS connectyhub_api_key TEXT;`
    console.log(sql)

    try {
        await supabase.rpc('exec_sql', { query: sql })
        console.log("Success with RPC")
    } catch (e) {
        console.log("RPC Error:", e)
    }
}

main()
