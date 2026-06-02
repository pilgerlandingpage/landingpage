import { PilgerAiShell } from '../PilgerAiShell'
import { getAgentOfficeSnapshot } from '@/lib/pilger-ai/agent-office'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'
import AgentOrgMap from './AgentOrgMap'

export const dynamic = 'force-dynamic'

export default async function PilgerAiOrgPage() {
    const [officeSnapshot, operationsSnapshot] = await Promise.all([
        getAgentOfficeSnapshot(),
        getPilgerAiOperationsSnapshot(),
    ])

    const configuredAgents = officeSnapshot.agents.filter(agent => agent.tone === 'success').length
    const connectedSectors = new Set(officeSnapshot.agents.map(agent => agent.source === 'virtual_brokers' ? 'Comercial' : agent.sector)).size

    return (
        <PilgerAiShell
            eyebrow="Organograma"
            title="Mapa vivo do ecossistema"
            description="Visualize a Central de Inteligencia, os setores conectados e cada agente com foto, fluxo de entrada e devolucao de dados."
            metrics={[
                { label: 'Agentes no mapa', value: String(officeSnapshot.totalAgents), note: `${configuredAgents} configurados para operar` },
                { label: 'Setores conectados', value: String(connectedSectors), note: 'Organizados por area de trabalho' },
                { label: 'Sinais recentes', value: String(operationsSnapshot.events.length), note: 'Eventos atualizados automaticamente' },
            ]}
            hideNote
        >
            <AgentOrgMap
                agents={officeSnapshot.agents}
                events={operationsSnapshot.events}
                tasks={operationsSnapshot.tasks}
            />
        </PilgerAiShell>
    )
}
