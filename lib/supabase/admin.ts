import { createClient } from '@supabase/supabase-js'
import { createSupabaseFetch } from './server'

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: createSupabaseFetch() } }
  )
}
