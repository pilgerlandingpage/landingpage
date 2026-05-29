import { PilgerAiShell } from '../PilgerAiShell'
import { PilgerAiEventStream, PilgerAiGovernanceStrip } from '../PilgerAiOperations'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'

export const dynamic = 'force-dynamic'

export default async function PilgerAiEventsPage() {
    const snapshot = await getPilgerAiOperationsSnapshot()

    return (
        <PilgerAiShell
            eyebrow="Eventos e Logs"
            title="Rastro operacional dos agentes"
            description="Linha do tempo com eventos, execucoes e logs que mostram o que os agentes e automacoes estao fazendo."
            pillars={[
                { title: 'Leads e atendimento', description: 'Conversas, qualificacoes, interacoes e sinais comerciais entram como eventos.' },
                { title: 'Marketing e trafego', description: 'Campanhas, criativos, pesquisas e oportunidades registram origem e impacto.' },
                { title: 'Imoveis e operacao', description: 'Cadastros, revisoes e alteracoes importantes ficam rastreaveis.' },
                { title: 'Logs tecnicos', description: 'Falhas, execucoes e automacoes ajudam a diagnosticar o funcionamento dos agentes.' },
            ]}
        >
            <PilgerAiGovernanceStrip />
            <PilgerAiEventStream
                title="Eventos e logs recebidos"
                description="Esteira real alimentada por workflows, automacoes e registros dos agentes."
                items={snapshot.events}
            />
        </PilgerAiShell>
    )
}
