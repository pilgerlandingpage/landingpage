import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { enqueueRegistrationMessages, logEventAgent, processDueEventMessages } from '@/lib/events/messages'
import { getPublicAppUrl } from '@/lib/app-url'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function loadEventRegistrationContext(supabase: any, eventId: string, registrationId: string) {
    const [eventRes, registrationRes, rulesRes] = await Promise.all([
        supabase.from('event_events').select('*').eq('id', eventId).maybeSingle(),
        supabase.from('event_registrations').select('*').eq('id', registrationId).maybeSingle(),
        supabase.from('event_automation_rules').select('*').eq('event_id', eventId).eq('is_active', true),
    ])

    if (eventRes.error) throw eventRes.error
    if (registrationRes.error) throw registrationRes.error
    if (rulesRes.error) throw rulesRes.error
    if (!eventRes.data) throw new Error('Evento nao encontrado.')
    if (!registrationRes.data) throw new Error('Inscricao nao encontrada.')

    return {
        event: eventRes.data,
        registration: registrationRes.data,
        rules: rulesRes.data || [],
    }
}

export const eventRegistrationCreated = inngest.createFunction(
    { id: 'event-registration-created', name: 'Agente de Eventos - nova inscricao' },
    { event: 'event/registration-created' },
    async ({ event, step }) => {
        const supabase = getSupabase()
        const { event_id, registration_id, reason, lead_initiated_first } = event.data

        const context = await step.run('load-event-registration', async () => {
            return loadEventRegistrationContext(supabase, event_id, registration_id)
        })

        const queued = await step.run('queue-event-messages', async () => {
            const publicUrl = `${getPublicAppUrl()}/eventos/${context.event.slug}`
            return enqueueRegistrationMessages(supabase, {
                event: context.event,
                registration: context.registration,
                rules: context.rules,
                publicUrl,
                leadInitiatedFirst: lead_initiated_first === true,
            })
        })

        await step.run('log-event-agent-registration', async () => {
            await logEventAgent(supabase, {
                event_id,
                registration_id,
                action: 'event_agent_registration_handled',
                message: 'Agente de Eventos recebeu nova inscricao e preparou as automacoes.',
                metadata: {
                    queued: queued.length,
                    reason,
                    lead_initiated_first: lead_initiated_first === true,
                    skipped_first_outbound: queued.filter((row: any) => row.status === 'skipped').length,
                },
            })
        })

        await step.sendEvent('process-event-queue-now', {
            name: 'event/process-message-queue',
            data: {
                event_id,
                reason: 'registration_created',
            },
        })

        return { queued: queued.length }
    }
)

export const eventProcessMessageQueue = inngest.createFunction(
    { id: 'event-process-message-queue', name: 'Agente de Eventos - processar fila' },
    { event: 'event/process-message-queue' },
    async ({ step }) => {
        const supabase = getSupabase()
        const results = await step.run('send-due-event-messages', async () => {
            return processDueEventMessages(supabase, 25)
        })
        return { processed: results.length, results }
    }
)

export const eventMessageQueueCron = inngest.createFunction(
    { id: 'event-message-queue-cron', name: 'Agente de Eventos - cron WhatsApp' },
    { cron: '*/5 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()
        const results = await step.run('send-due-event-messages-cron', async () => {
            return processDueEventMessages(supabase, 30)
        })
        return { processed: results.length, results }
    }
)

export const eventFunctions = [
    eventRegistrationCreated,
    eventProcessMessageQueue,
    eventMessageQueueCron,
]
