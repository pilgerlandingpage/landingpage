import { createClient } from '@supabase/supabase-js'
import { getPublicAppUrl } from '@/lib/app-url'
import { enqueueCandidateMessages, logCandidateAgent, processDueCandidateMessages } from '@/lib/broker-candidates/messages'
import { inngest } from './client'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function loadCandidateContext(supabase: any, candidateId: string) {
    const [candidateRes, rulesRes] = await Promise.all([
        supabase.from('broker_candidates').select('*').eq('id', candidateId).maybeSingle(),
        supabase.from('broker_candidate_automation_rules').select('*').eq('is_active', true),
    ])

    if (candidateRes.error) throw candidateRes.error
    if (rulesRes.error) throw rulesRes.error
    if (!candidateRes.data) throw new Error('Candidato nao encontrado.')

    return {
        candidate: candidateRes.data,
        rules: rulesRes.data || [],
    }
}

async function isCandidateAgentEnabled(supabase: any) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'broker_candidate_agent_enabled')
        .maybeSingle()

    return data?.value !== 'false'
}

export const brokerCandidateCreated = inngest.createFunction(
    { id: 'broker-candidate-created', name: 'Agente de Recrutamento - novo candidato' },
    { event: 'broker-candidate/created' },
    async ({ event, step }) => {
        const supabase = getSupabase()
        const { candidate_id, reason } = event.data
        if (!await isCandidateAgentEnabled(supabase)) return { skipped: true, reason: 'broker_candidate_agent_disabled' }

        const context = await step.run('load-broker-candidate', async () => {
            return loadCandidateContext(supabase, candidate_id)
        })

        const queued = await step.run('queue-broker-candidate-messages', async () => {
            const createdQueued = await enqueueCandidateMessages(supabase, {
                candidate: context.candidate,
                rules: context.rules,
                publicUrl: `${getPublicAppUrl()}/trabalhe-conosco`,
                triggerType: 'created',
            })

            const highPotentialQueued = Number(context.candidate.potential_score || 0) >= 80
                ? await enqueueCandidateMessages(supabase, {
                    candidate: context.candidate,
                    rules: context.rules,
                    publicUrl: `${getPublicAppUrl()}/trabalhe-conosco`,
                    triggerType: 'high_potential',
                })
                : []

            return [...createdQueued, ...highPotentialQueued]
        })

        await step.run('log-broker-candidate-agent', async () => {
            await logCandidateAgent(supabase, {
                candidate_id,
                action: 'broker_candidate_agent_handled',
                message: 'Agente de recrutamento recebeu o candidato e preparou automacoes.',
                metadata: { queued: queued.length, reason },
            })
        })

        await step.sendEvent('process-broker-candidate-queue-now', {
            name: 'broker-candidate/process-message-queue',
            data: {
                candidate_id,
                reason: 'candidate_created',
            },
        })

        return { queued: queued.length }
    }
)

export const brokerCandidateProcessMessageQueue = inngest.createFunction(
    { id: 'broker-candidate-process-message-queue', name: 'Agente de Recrutamento - processar fila' },
    { event: 'broker-candidate/process-message-queue' },
    async ({ step }) => {
        const supabase = getSupabase()
        if (!await isCandidateAgentEnabled(supabase)) return { skipped: true, reason: 'broker_candidate_agent_disabled' }
        const results = await step.run('send-due-broker-candidate-messages', async () => {
            return processDueCandidateMessages(supabase, 25)
        })
        return { processed: results.length, results }
    }
)

export const brokerCandidateMessageQueueCron = inngest.createFunction(
    { id: 'broker-candidate-message-queue-cron', name: 'Agente de Recrutamento - cron WhatsApp' },
    { cron: '*/5 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()
        if (!await isCandidateAgentEnabled(supabase)) return { skipped: true, reason: 'broker_candidate_agent_disabled' }
        const results = await step.run('send-due-broker-candidate-messages-cron', async () => {
            return processDueCandidateMessages(supabase, 30)
        })
        return { processed: results.length, results }
    }
)

export const candidateFunctions = [
    brokerCandidateCreated,
    brokerCandidateProcessMessageQueue,
    brokerCandidateMessageQueueCron,
]
