import { PilgerAiShell } from '../PilgerAiShell'
import { PilgerAiGovernanceStrip, PilgerAiWorkQueue } from '../PilgerAiOperations'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'

export const dynamic = 'force-dynamic'

export default async function PilgerAiTasksPage() {
    const snapshot = await getPilgerAiOperationsSnapshot()

    return (
        <PilgerAiShell
            eyebrow="Tarefas"
            title="Central de trabalho dos agentes"
            description="Fila com pendencias operacionais, execucoes de workflow e itens que precisam de acao humana ou de agente."
            pillars={[
                { title: 'Origem clara', description: 'Cada tarefa mostra de onde veio: workflow, imovel, atendimento, marketing ou sistema.' },
                { title: 'Prioridade visivel', description: 'Itens bloqueados, em falha ou aguardando revisao aparecem com mais urgencia.' },
                { title: 'Acao direta', description: 'Quando existe uma tela de origem, o item abre o caminho para resolver a pendencia.' },
            ]}
        >
            <PilgerAiGovernanceStrip />
            <PilgerAiWorkQueue
                title="Tarefas abertas"
                description="Fila unificada com execucoes de workflow e pendencias de cadastro que precisam de acao humana ou de agente."
                items={snapshot.tasks}
            />
        </PilgerAiShell>
    )
}
