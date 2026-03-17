import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim()

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

async function migrate() {
    console.log('🔄 Checking config column in whatsapp_instances...')

    const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, config')
        .limit(1)

    if (error && error.message.includes('config')) {
        console.log('❌ Column "config" does not exist. Run this SQL in Supabase Dashboard:')
        console.log('ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS config JSONB DEFAULT \'{}\'::jsonb;')
    } else {
        console.log('✅ Column "config" exists!')
        if (data) data.forEach(i => console.log(`   - ${i.id}: config = ${JSON.stringify(i.config)}`))
    }
}

migrate().catch(console.error)
