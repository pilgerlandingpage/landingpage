import { PilgerAiShell } from '../PilgerAiShell'
import { getAgentOfficeSnapshot } from '@/lib/pilger-ai/agent-office'
import AgentOfficeClient from './AgentOfficeClient'

export const dynamic = 'force-dynamic'

export default async function PilgerAiAgentsPage() {
    const snapshot = await getAgentOfficeSnapshot()

    return (
        <PilgerAiShell
            eyebrow="Agentes"
            title="Escritorio dos colaboradores digitais"
            description="Central para visualizar, organizar e controlar os prompts dos agentes que trabalham no ecossistema Pilger AI."
            hideNote
        >
            <AgentOfficeClient snapshot={snapshot} />
        </PilgerAiShell>
    )
}
