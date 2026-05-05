import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkAdminContacts() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
        .from('admin_alert_contacts')
        .select('*')

    if (error) {
        console.error('Error fetching admin contacts:', error)
    } else {
        console.log('Admin Contacts:', data)
    }
}

checkAdminContacts()
