import { PilgerAiShell } from './PilgerAiShell'
import { PilgerAiEventStream, PilgerAiGovernanceStrip, PilgerAiLiveMetrics, PilgerAiWorkQueue } from './PilgerAiOperations'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'

export const dynamic = 'force-dynamic'

export default async function PilgerAiOverviewPage() {
    const snapshot = await getPilgerAiOperationsSnapshot()

    return (
        <PilgerAiShell
            eyebrow="Pilger AI"
            title="Operacao dos agentes"
            description="Central para acompanhar agentes, tarefas, aprovacoes e eventos reais do ecossistema Pilger."
            metrics={snapshot.metrics}
            pillars={[
                { title: 'Agentes configurados', description: 'Prompts, vozes, WhatsApp e regras comerciais ficam centralizados no escritorio dos agentes.' },
                { title: 'Eventos monitorados', description: 'Leads, imoveis, campanhas e automacoes alimentam a fila operacional.' },
                { title: 'Tarefas e aprovacoes', description: 'Pendencias e acoes sensiveis ficam visiveis para decisao humana.' },
                { title: 'Inteligencia compartilhada', description: 'A Central de Inteligencia entrega contexto comum para blog, WhatsApp, radar, trafego e CEO.' },
            ]}
        >
            <PilgerAiLiveMetrics metrics={snapshot.metrics} />
            <PilgerAiGovernanceStrip />
            <div className="pilger-ai-ops-grid">
                <PilgerAiWorkQueue
                    title="Fila viva"
                    description="Tarefas abertas a partir de workflows, imoveis em analise e pendencias operacionais."
                    items={snapshot.tasks.slice(0, 6)}
                />
                <PilgerAiEventStream
                    title="Ultimos eventos"
                    description="Eventos recentes registrados pelo motor de automacao."
                    items={snapshot.events.slice(0, 6)}
                />
            </div>
        </PilgerAiShell>
    )
}
