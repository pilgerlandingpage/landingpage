import { RadioTower } from 'lucide-react'
import { PilgerAiShell } from '../PilgerAiShell'
import { getAgentOfficeSnapshot } from '@/lib/pilger-ai/agent-office'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'
import { createAdminClient } from '@/lib/supabase/server'
import AgentOrgLiveRefresh from './AgentOrgLiveRefresh'
import AgentOrgMap from './AgentOrgMap'

export const dynamic = 'force-dynamic'

const GRAPH_LAYOUT_CONFIG_KEY = 'pilger_ai_org_graph_layout'

async function getSavedOrgGraphLayout() {
    try {
        const supabase = createAdminClient()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', GRAPH_LAYOUT_CONFIG_KEY)
            .maybeSingle()

        return typeof data?.value === 'string' ? data.value : null
    } catch (error) {
        console.warn('[PilgerAiOrgPage] Failed to load graph layout:', error)
        return null
    }
}

export default async function PilgerAiOrgPage() {
    const [officeSnapshot, operationsSnapshot, savedGraphLayout] = await Promise.all([
        getAgentOfficeSnapshot(),
        getPilgerAiOperationsSnapshot(),
        getSavedOrgGraphLayout(),
    ])

    const configuredAgents = officeSnapshot.agents.filter(agent => agent.tone === 'success').length
    const connectedSectors = new Set(officeSnapshot.agents.map(agent => agent.source === 'virtual_brokers' ? 'Comercial' : agent.sector)).size

    return (
        <PilgerAiShell
            eyebrow="Organograma"
            title="Mapa vivo do ecossistema"
            description="Visualize a Central de Inteligencia como um grafo vivo, com setores e agentes interligados, moviveis e sincronizados."
            heroDetailEyebrow="Organismo vivo"
            heroDetailTitle="Rede interligada dos agentes"
            heroActions={(
                <>
                    <div className="agent-org-live-badge">
                        <RadioTower size={16} />
                        {configuredAgents} trabalhando
                    </div>
                    <AgentOrgLiveRefresh />
                </>
            )}
            compactMetricsInHero
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
                savedLayout={savedGraphLayout}
                tasks={operationsSnapshot.tasks}
            />
        </PilgerAiShell>
    )
}
