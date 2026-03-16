// Temporary migration script - run with: node scripts/migrate-pending-messages.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

const supabase = createClient(url, key, {
    db: { schema: 'public' }
})

// Test if columns exist by trying to select them
const { data, error } = await supabase
    .from('whatsapp_ai_conversations')
    .select('pending_messages, human_takeover_at')
    .limit(1)

if (error) {
    console.log('Columns do not exist yet. Error:', error.message)
    console.log('')
    console.log('Please run the following SQL in Supabase Dashboard > SQL Editor:')
    console.log('')
    console.log("ALTER TABLE whatsapp_ai_conversations ADD COLUMN IF NOT EXISTS pending_messages jsonb DEFAULT '[]'::jsonb;")
    console.log("ALTER TABLE whatsapp_ai_conversations ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz DEFAULT NULL;")
    console.log('')
    console.log('Dashboard URL: https://supabase.com/dashboard/project/' + url.match(/https:\/\/(.+?)\.supabase/)?.[1] + '/sql/new')
} else {
    console.log('✅ Columns already exist! Data:', JSON.stringify(data))
}
