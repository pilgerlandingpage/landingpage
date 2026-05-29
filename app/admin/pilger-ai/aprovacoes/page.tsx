import { PilgerAiShell } from '../PilgerAiShell'
import { PilgerAiGovernanceStrip, PilgerAiWorkQueue } from '../PilgerAiOperations'
import { getPilgerAiOperationsSnapshot } from '@/lib/pilger-ai/operations'

export const dynamic = 'force-dynamic'

export default async function PilgerAiApprovalsPage() {
    const snapshot = await getPilgerAiOperationsSnapshot()

    return (
        <PilgerAiShell
            eyebrow="Aprovacoes"
            title="Controle humano de acoes sensiveis"
            description="Fila para revisar itens que a IA ou a operacao nao devem concluir sem decisao humana."
            pillars={[
                { title: 'Imoveis', description: 'Cadastros em analise e alteracoes comerciais sensiveis entram para revisao.' },
                { title: 'Marketing', description: 'Publicacoes, campanhas e disparos podem ser segurados para aprovacao.' },
                { title: 'Dados e automacoes', description: 'Mudancas de regra, integracao ou exclusao devem manter controle humano.' },
            ]}
        >
            <PilgerAiGovernanceStrip />
            <PilgerAiWorkQueue
                title="Aprovacoes pendentes"
                description="Hoje a primeira fila real vem dos imoveis criados com IA ou cadastrados como em analise."
                items={snapshot.approvals}
                emptyText="Nenhuma aprovacao pendente agora."
            />
        </PilgerAiShell>
    )
}
