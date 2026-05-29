import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { functions } from '@/lib/inngest/functions'

export const maxDuration = 800

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
})
