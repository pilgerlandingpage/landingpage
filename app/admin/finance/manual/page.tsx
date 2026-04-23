import { BookOpenText } from 'lucide-react'

export default function FinanceManualPage() {
    return (
        <div style={{ padding: '24px 18px 36px' }}>
            <div style={{ marginBottom: 14 }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpenText size={26} /> Manual Financeiro
                </h1>
                <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                    Guia pratico para uso diario do sistema financeiro, com linguagem simples e exemplos reais.
                </p>
            </div>

            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title">Visao geral</div>
                <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                    O modulo financeiro organiza receitas, despesas, contas a pagar, contas a receber, conciliacao bancaria, comissoes,
                    relatorios (Fluxo de Caixa e DRE), fechamento mensal e exportacao contabil.
                </p>
            </div>

            <div
                className="chart-card"
                style={{ marginBottom: 14, border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.06)' }}
            >
                <div className="chart-title">SECAO 1. Para que serve cada area</div>
                <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                    Use esta parte para entender rapidamente quando entrar em cada menu.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <div className="chart-card">
                    <div className="chart-title">Cadastros</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                        Serve para preparar a base do financeiro: categorias, formas de pagamento e favorecidos.
                    </p>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Sem cadastro organizado, os relatórios ficam confusos.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Movimentacoes</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                        Serve para registrar o dia a dia: novos lancamentos, contas a pagar e contas a receber.
                    </p>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Aqui voce controla vencimento, quitacao e pendencias.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Comissoes</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                        Serve para criar regras e apurar comissoes de corretores com rastreabilidade.
                    </p>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Status acompanha todo o ciclo ate pagamento.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Conciliacao e Fechamento</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                        Serve para validar banco vs sistema, fechar competencia e proteger periodos finalizados.
                    </p>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Tambem inclui exportacao contabil para o escritorio.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Relatorios</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                        Serve para analise gerencial com Fluxo de Caixa e DRE.
                    </p>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Ajuda na tomada de decisao com dados consolidados.
                    </p>
                </div>
            </div>

            <div
                className="chart-card"
                style={{ marginTop: 14, marginBottom: 14, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)' }}
            >
                <div className="chart-title">SECAO 2. Exemplos de uso</div>
                <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                    Use esta parte como passo a passo pronto. O admin pode seguir item por item.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <div className="chart-card">
                    <div className="chart-title">Exemplo A. Despesa mensal (aluguel)</div>
                    <ol style={{ marginTop: 8, color: 'var(--text-muted)', paddingLeft: 18, display: 'grid', gap: 6 }}>
                        <li>Abra Cadastros e confira categoria Aluguel e favorecido Imobiliaria XYZ.</li>
                        <li>Entre em Novo Lancamento.</li>
                        <li>Tipo despesa, valor R$ 4.500,00, vencimento dia 10, salvar.</li>
                        <li>No dia do pagamento, abra Contas a Pagar e marque como pago.</li>
                    </ol>
                    <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        Resultado: titulo sai do pendente e entra no realizado do Fluxo de Caixa.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Exemplo B. Recebimento de venda</div>
                    <ol style={{ marginTop: 8, color: 'var(--text-muted)', paddingLeft: 18, display: 'grid', gap: 6 }}>
                        <li>Abra Novo Lancamento.</li>
                        <li>Tipo receita, descricao sinal da venda, valor R$ 35.000,00, salvar.</li>
                        <li>Quando cair no banco, confirmar em Contas a Receber.</li>
                        <li>Depois, conciliar em Conciliacao Bancaria.</li>
                    </ol>
                    <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        Resultado: receita conciliada, refletida no DRE e no saldo.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Exemplo C. Comissao do corretor</div>
                    <ol style={{ marginTop: 8, color: 'var(--text-muted)', paddingLeft: 18, display: 'grid', gap: 6 }}>
                        <li>Criar regra de comissao (exemplo: 5%).</li>
                        <li>Informar valor da venda e corretor na apuracao.</li>
                        <li>Calcular, aprovar e liberar.</li>
                        <li>Quando pagar, atualizar status para paga.</li>
                    </ol>
                    <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        Resultado: comissao controlada de ponta a ponta.
                    </p>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Exemplo D. Fechamento + exportacao</div>
                    <ol style={{ marginTop: 8, color: 'var(--text-muted)', paddingLeft: 18, display: 'grid', gap: 6 }}>
                        <li>Conferir pendencias em AP, AR e conciliacao.</li>
                        <li>Fechar a competencia no Fechamento Mensal.</li>
                        <li>Bloquear periodo quando estiver finalizado.</li>
                        <li>Gerar Exportacao Contabil e enviar ao escritorio.</li>
                    </ol>
                    <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        Resultado: periodo protegido e entrega contabil concluida.
                    </p>
                </div>
            </div>

            <div className="chart-card" style={{ marginTop: 14 }}>
                <div className="chart-title">Guia rapido de decisao</div>
                <ul style={{ marginTop: 8, color: 'var(--text-muted)', paddingLeft: 18, display: 'grid', gap: 6 }}>
                    <li>Entrou ou saiu dinheiro e nao tem lancamento: usar Novo Lancamento.</li>
                    <li>Titulo existe mas nao foi quitado: usar Contas a Pagar ou Contas a Receber.</li>
                    <li>Banco diferente do sistema: usar Conciliacao Bancaria.</li>
                    <li>Analise de desempenho: usar Fluxo de Caixa e DRE.</li>
                    <li>Mes encerrado: usar Fechamento Mensal e depois Exportacao Contabil.</li>
                </ul>
            </div>
        </div>
    )
}
