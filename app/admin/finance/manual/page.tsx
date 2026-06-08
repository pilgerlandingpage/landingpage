import { BookOpenText } from 'lucide-react'

const SECTION_BLUE = { border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' }
const SECTION_GREEN = { border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)' }
const SECTION_GOLD = { border: '1px solid rgba(196,168,75,0.4)', background: 'rgba(196,168,75,0.07)' }
const SECTION_RED = { border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }

function SectionHeader({ color, title, subtitle }: { color: React.CSSProperties; title: string; subtitle: string }) {
    return (
        <div className="chart-card" style={{ marginBottom: 14, marginTop: 24, ...color }}>
            <div className="chart-title" style={{ fontSize: '1rem' }}>{title}</div>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>{subtitle}</p>
        </div>
    )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="chart-card">
            <div className="chart-title" style={{ marginBottom: 10 }}>{title}</div>
            {children}
        </div>
    )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'rgba(196,168,75,0.25)', color: '#c4a84b', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55 }}>{children}</span>
        </div>
    )
}

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: 'rgba(196,168,75,0.08)', border: '1px solid rgba(196,168,75,0.25)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
            <span style={{ color: '#c4a84b', fontWeight: 700, fontSize: '0.78rem' }}>DICA  </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{children}</span>
        </div>
    )
}

function Warn({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.78rem' }}>ATENÇÃO  </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{children}</span>
        </div>
    )
}

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{ display: 'inline-block', background: color, color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, marginRight: 4 }}>
            {label}
        </span>
    )
}

export default function FinanceManualPage() {
    return (
        <div style={{ padding: '24px 18px 48px', maxWidth: 980, margin: '0 auto' }}>

            {/* Cabecalho */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpenText size={26} /> Manual do Sistema Financeiro
                </h1>
                <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                    Guia completo e pratico para uso diario. Leia uma vez e consulte quando precisar.
                </p>
            </div>

            {/* Indice */}
            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>Indice rapido</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '4px 24px' }}>
                    {[
                        '1. Visao geral do sistema',
                        '2. Primeiro acesso — configuracao inicial',
                        '3. Entidades PF e PJ',
                        '4. Cadastros (categorias, favorecidos etc.)',
                        '5. Novo lancamento',
                        '6. Contas a Pagar (AP)',
                        '7. Contas a Receber (AR)',
                        '8. Alertas de vencimento',
                        '9. Importacao em massa via CSV',
                        '10. Comissoes dos corretores',
                        '11. Relatorio por Corretor',
                        '12. Conciliacao bancaria',
                        '13. Fechamento mensal',
                        '14. Exportacao contabil',
                        '15. DRE Gerencial',
                        '16. Fluxo de Caixa',
                        '17. Dashboard — painel principal',
                        '18. Exemplos do dia a dia',
                        '19. Guia rapido de decisao',
                    ].map((item, i) => (
                        <div key={i} style={{ color: 'var(--text-muted)', fontSize: '0.84rem', padding: '3px 0' }}>{item}</div>
                    ))}
                </div>
            </div>

            {/* ── SECAO 1 ── */}
            <SectionHeader color={SECTION_BLUE} title="1. Visao geral do sistema" subtitle="Entenda o que o financeiro cobre antes de comecar a usar." />
            <Card title="O que o sistema faz">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.65 }}>
                    O modulo financeiro controla <strong>tudo que envolve dinheiro</strong> na imobiliaria: lancamentos de receitas e despesas,
                    contas a pagar e a receber, comissoes dos 6 corretores, conciliacao bancaria, fechamento mensal e relatorios gerenciais.
                    Ele tambem separa os custos entre <strong>Guilherme Pilger (PF)</strong> e <strong>Imobiliaria Guilherme Pilger (PJ)</strong>,
                    permitindo ver o resultado de cada entidade de forma independente ou consolidada.
                </p>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
                {[
                    { title: 'Cadastros', desc: 'Base do sistema: categorias, formas de pagamento, favorecidos, centros de custo, contas bancarias e entidades PF/PJ.' },
                    { title: 'Movimentacoes', desc: 'Dia a dia: novos lancamentos, contas a pagar, contas a receber. Onde tudo acontece.' },
                    { title: 'Comissoes', desc: 'Controle do ciclo completo de comissao de cada corretor, do calculo ate o pagamento.' },
                    { title: 'Relatorios', desc: 'DRE Gerencial, Fluxo de Caixa e Relatorio por Corretor. Para tomada de decisao.' },
                    { title: 'Conciliacao e Fechamento', desc: 'Validar banco vs sistema, fechar mes e exportar para contabilidade.' },
                    { title: 'Alertas automaticos', desc: 'Emails diarios as 8h avisando sobre contas que vencem em 3 dias ou ja vencidas.' },
                ].map((item) => (
                    <div key={item.title} className="chart-card" style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{item.title}</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
                    </div>
                ))}
            </div>

            {/* ── SECAO 2 ── */}
            <SectionHeader color={SECTION_GOLD} title="2. Primeiro acesso — configuracao inicial" subtitle="Faca isso uma unica vez antes de comecar a lancar qualquer coisa." />
            <Card title="Ordem recomendada de configuracao">
                <Step n={1}>Acesse <strong>Cadastros → Entidades PF/PJ</strong> e adicione o CPF de Guilherme Pilger e o CNPJ da Imobiliaria Guilherme Pilger. As entidades ja foram criadas — basta editar e preencher os documentos.</Step>
                <Step n={2}>Acesse <strong>Cadastros → Categorias</strong> e crie as categorias que a empresa usa. Exemplos: Aluguel, Servicos, Folha de Pagamento, Comissao, Honorarios, Publicidade, Manutencao, Impostos, Receita de Venda.</Step>
                <Step n={3}>Dentro de cada categoria, crie subcategorias se precisar detalhar. Exemplo: categoria Impostos → subcategorias IRPF, IRPJ, ISS, DAS.</Step>
                <Step n={4}>Acesse <strong>Cadastros → Formas de Pagamento</strong> e cadastre: PIX, Transferencia, Boleto, Cartao, Cheque.</Step>
                <Step n={5}>Acesse <strong>Cadastros → Favorecidos</strong> e cadastre empresas e pessoas que aparecem nos lancamentos. Coloque CPF/CNPJ, email e telefone para facilitar consulta futura.</Step>
                <Step n={6}>Acesse <strong>Cadastros → Centros de Custo</strong> e crie se quiser separar por area: Diretoria, Operacao, Marketing, TI.</Step>
                <Step n={7}>Acesse <strong>Cadastros → Contas Bancarias</strong> e cadastre as contas que a empresa usa para conciliacao.</Step>
                <Tip>Dedique 30 minutos nessa configuracao inicial. Com a base bem organizada, todos os relatorios sao gerados automaticamente e sem retrabalho.</Tip>
            </Card>

            {/* ── SECAO 3 ── */}
            <SectionHeader color={SECTION_GREEN} title="3. Entidades PF e PJ" subtitle="A principal novidade do sistema: separacao fiscal entre pessoa fisica e juridica." />
            <Card title="Para que serve">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.65 }}>
                    A imobiliaria opera com duas entidades juridicas distintas. Cada lancamento, conta a pagar e conta a receber
                    pode ser marcado como pertencente a <strong>Guilherme Pilger (PF)</strong> ou <strong>Imobiliaria Guilherme Pilger (PJ)</strong>.
                    Isso permite ver DRE, Fluxo de Caixa e saldo de forma separada para cada entidade, ou consolidado.
                </p>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
                <Card title="Exemplos de lancamentos PF (Guilherme Pilger)">
                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                        <li>Pro-labore recebido</li>
                        <li>IRPF pago</li>
                        <li>Despesas pessoais pagas pela empresa</li>
                        <li>Alugueis de imoveis em nome pessoal</li>
                        <li>Investimentos pessoais</li>
                    </ul>
                </Card>
                <Card title="Exemplos de lancamentos PJ (Imobiliaria)">
                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                        <li>Comissoes recebidas de vendas</li>
                        <li>Folha de pagamento e comissoes dos corretores</li>
                        <li>Aluguel do escritorio</li>
                        <li>Publicidade e marketing</li>
                        <li>Impostos da empresa (ISS, IRPJ, DAS)</li>
                    </ul>
                </Card>
            </div>
            <div className="chart-card" style={{ marginTop: 12 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>Como usar o filtro de entidade</div>
                <Step n={1}>No painel de <strong>Lancamentos</strong>, <strong>Contas a Pagar</strong> ou <strong>Contas a Receber</strong>, selecione a entidade no filtro do topo e clique em Atualizar Periodo. Os dados exibidos serao apenas da entidade escolhida.</Step>
                <Step n={2}>Nos relatorios <strong>DRE Gerencial</strong> e <strong>Fluxo de Caixa</strong>, escolha a entidade no dropdown antes de clicar em Recalcular. O titulo do relatorio indicara qual entidade esta sendo exibida.</Step>
                <Step n={3}>Para ver tudo junto, selecione <strong>Consolidado (todas)</strong> — padrao ao abrir qualquer tela.</Step>
                <Tip>Acostume a sempre marcar a entidade correta ao criar lancamentos. Isso economiza horas de revisao no fechamento do mes.</Tip>
            </div>

            {/* ── SECAO 4 ── */}
            <SectionHeader color={SECTION_BLUE} title="4. Cadastros" subtitle="A base que alimenta todos os relatorios. Configure uma vez, use para sempre." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <Card title="Categorias e Subcategorias">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 8 }}>
                        Categorias agrupam lancamentos no DRE e no Fluxo de Caixa. Subcategorias detalham ainda mais.
                        Crie apenas o que vai usar de verdade — excesso de categorias confunde mais do que ajuda.
                    </p>
                    <Tip>Comece com 6 a 10 categorias. Adicione mais conforme a necessidade aparecer.</Tip>
                </Card>
                <Card title="Favorecidos">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 8 }}>
                        Empresa ou pessoa que aparece nos lancamentos. Pode ser fornecedor, corretor, cliente, proprietario.
                        Cadastre CPF/CNPJ para facilitar controle fiscal e email para contato futuro.
                    </p>
                    <Tip>Use o campo Tipo para classificar como Pessoa Fisica ou Pessoa Juridica — ajuda nos filtros.</Tip>
                </Card>
                <Card title="Centros de Custo">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 8 }}>
                        Permite separar despesas por area interna: Diretoria, Vendas, Operacao, TI.
                        Util para saber quanto cada area gasta sem precisar de planilha separada.
                    </p>
                </Card>
                <Card title="Contas Bancarias">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 8 }}>
                        Cadastre cada conta bancaria usada pela empresa. Isso permite vincular lancamentos a contas especificas
                        e fazer conciliacao bancaria corretamente.
                    </p>
                </Card>
            </div>

            {/* ── SECAO 5 ── */}
            <SectionHeader color={SECTION_GREEN} title="5. Novo lancamento" subtitle="Use para registrar qualquer entrada ou saida de dinheiro no dia a dia." />
            <Card title="Quando usar Novo Lancamento">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    Use quando o dinheiro <strong>ja entrou ou saiu</strong>: pagamento efetuado, receita recebida, despesa quitada.
                    Se o dinheiro ainda vai entrar ou sair, use Contas a Pagar ou Contas a Receber.
                </p>
                <Step n={1}><strong>Descricao:</strong> escreva algo que identifique o lancamento meses depois. Ex: "Aluguel escritorio junho" e nao apenas "Aluguel".</Step>
                <Step n={2}><strong>Tipo:</strong> Despesa (saida) ou Receita (entrada).</Step>
                <Step n={3}><strong>Entidade PF/PJ:</strong> selecione a qual entidade pertence este lancamento. Campo obrigatorio para relatorios separados.</Step>
                <Step n={4}><strong>Data:</strong> data em que o evento ocorreu (nao a data do lancar no sistema).</Step>
                <Step n={5}><strong>Categoria e Subcategoria:</strong> escolha com cuidado — define onde aparece no DRE.</Step>
                <Step n={6}><strong>Favorecido:</strong> para quem foi pago ou de quem foi recebido.</Step>
                <Step n={7}><strong>Status de pagamento:</strong> Pago (ja realizado), Pendente (a confirmar), Cancelado.</Step>
                <Step n={8}>Clique em <strong>Salvar lancamento</strong>. Aparece imediatamente nos relatorios.</Step>
                <Warn>Nao use Novo Lancamento para criar contas a pagar com vencimento futuro — use a tela Contas a Pagar. Caso contrario, o Fluxo de Caixa fica incorreto.</Warn>
            </Card>

            {/* ── SECAO 6 ── */}
            <SectionHeader color={SECTION_BLUE} title="6. Contas a Pagar (AP)" subtitle="Titulos que a empresa deve pagar. Controle vencimento, urgencia e quitacao." />
            <Card title="Como funciona">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    Cada conta a pagar tem: valor total, vencimento, favorecido, categoria e entidade. O sistema calcula automaticamente
                    o valor pago, o saldo restante e o status. Contas com pagamento parcial ficam como <strong>Parcial</strong>;
                    quando o saldo zera, viram <strong>Pago</strong>.
                </p>
                <Step n={1}>Crie a conta a pagar pelo formulario na tela (igual ao Novo Lancamento, com campo de vencimento).</Step>
                <Step n={2}>Na listagem, contas <Badge label="vencido" color="#ef4444" /> e <Badge label="vence em Xd" color="#f59e0b" /> aparecem com badges coloridos — nao ignore essas marcacoes.</Step>
                <Step n={3}>Para pagar: clique em <strong>Quitar</strong> (pagamento total) ou <strong>Baixa parcial</strong> (pagamento parcial, informa o valor pago).</Step>
                <Step n={4}>Para reabrir um titulo pago indevidamente: clique em <strong>Reabrir</strong>.</Step>
                <Tip>Use o filtro <strong>Entidade</strong> para ver apenas as contas da PF ou da PJ. Use o filtro <strong>Status</strong> = Vencido para priorizar o que esta atrasado.</Tip>
            </Card>
            <Card title="Botoes da barra superior">
                <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ minWidth: 110, fontWeight: 700, fontSize: '0.82rem', color: '#c4a84b' }}>Enviar Alertas</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Dispara imediatamente um email para todos os admins com a lista de contas vencidas e vencendo em 3 dias. Util quando voce quer avisar o time antes de uma reuniao.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ minWidth: 110, fontWeight: 700, fontSize: '0.82rem', color: '#c4a84b' }}>Importar CSV</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Importa varios lancamentos de uma vez via planilha. Ideal para migrar dados ou lancar muitas despesas de uma vez. Veja Secao 9 para detalhes.</span>
                    </div>
                </div>
            </Card>

            {/* ── SECAO 7 ── */}
            <SectionHeader color={SECTION_GREEN} title="7. Contas a Receber (AR)" subtitle="Valores que clientes ou terceiros devem para a empresa." />
            <Card title="Como funciona">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    Funciona igual as Contas a Pagar, porem para entradas. Exemplos de uso na imobiliaria:
                </p>
                <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: 16, margin: '0 0 10px', lineHeight: 1.7 }}>
                    <li>Comissao de venda a receber do comprador (parcelada ou a prazo)</li>
                    <li>Aluguel de administracao a receber do locatario</li>
                    <li>Taxa de administracao parcelada</li>
                    <li>Reembolso de despesas de terceiros</li>
                </ul>
                <Step n={1}>Crie o titulo informando valor, vencimento e entidade (PF ou PJ).</Step>
                <Step n={2}>Quando receber, clique em <strong>Receber</strong> ou <strong>Recebimento parcial</strong>.</Step>
                <Step n={3}>Titulos vencidos aparecem em vermelho. Use o filtro Status = Vencido para agir rapidamente.</Step>
                <Tip>Lancamentos de AR quitados entram automaticamente no Fluxo de Caixa como entradas realizadas.</Tip>
            </Card>

            {/* ── SECAO 8 ── */}
            <SectionHeader color={SECTION_RED} title="8. Alertas de vencimento" subtitle="O sistema avisa automaticamente sobre contas criticas. Sem precisar de planilha de controle." />
            <Card title="Como funcionam os alertas">
                <div style={{ display: 'grid', gap: 12, marginTop: 4 }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Alerta automatico diario (8h da manha)</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
                            Todo dia as 8h o sistema verifica automaticamente quais contas a pagar estao vencidas ou vencem nos proximos 3 dias
                            e envia um email para todos os administradores master. O email mostra: quantidade de vencidos, quantidade vencendo em breve
                            e o valor total em aberto.
                        </p>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Badges visuais na listagem</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
                            Na tela de Contas a Pagar, cada linha com titulo pendente mostra um badge colorido ao lado da data de vencimento:
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Badge label="3d vencido" color="#ef4444" />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Vermelho = vencido ha X dias</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Badge label="vence em 2d" color="#f59e0b" />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Amarelo = vence em ate 3 dias</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Card no Dashboard</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
                            O dashboard principal exibe o card <strong>Vencimentos Proximos</strong> com o total de titulos criticos e o valor em aberto.
                            Se estiver vermelho, ha titulos vencidos que precisam de atencao imediata.
                        </p>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Alerta manual sob demanda</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
                            Na tela de Contas a Pagar, o botao <strong>Enviar Alertas</strong> dispara o email na hora, fora do horario automatico.
                            Util antes de reunioes de gestao financeira.
                        </p>
                    </div>
                </div>
                <Warn>O email so e enviado para admins com cargo master e com email cadastrado. Verifique nas configuracoes de usuarios se todos os gestores estao como master.</Warn>
            </Card>

            {/* ── SECAO 9 ── */}
            <SectionHeader color={SECTION_GOLD} title="9. Importacao em massa via CSV" subtitle="Para migrar dados de planilhas ou lancar muitos registros de uma vez." />
            <Card title="Como importar">
                <Step n={1}>Na tela de <strong>Contas a Pagar</strong>, clique em <strong>Importar CSV</strong>.</Step>
                <Step n={2}>Clique em <strong>Baixar template CSV de exemplo</strong> para ter o modelo correto com os campos certos.</Step>
                <Step n={3}>Abra o template no Excel ou Google Planilhas e preencha seus dados.</Step>
                <Step n={4}>Salve como CSV e suba o arquivo na janela de importacao.</Step>
                <Step n={5}>O sistema processa e mostra: quantos foram importados e quais linhas tiveram erro (com o motivo).</Step>
            </Card>
            <Card title="Campos do CSV">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 4 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Campo</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Obrigatorio</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Formato aceito</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['description', 'Sim', 'Texto livre'],
                                ['entry_type', 'Sim', 'receita / despesa (ou income / expense)'],
                                ['amount', 'Sim', '4500.00 ou R$ 4.500,00'],
                                ['entry_date', 'Sim', 'DD/MM/AAAA ou AAAA-MM-DD'],
                                ['category', 'Nao', 'Texto livre (deve existir no cadastro)'],
                                ['counterparty_name', 'Nao', 'Nome do favorecido'],
                                ['notes', 'Nao', 'Observacao livre'],
                                ['entity_id', 'Nao', 'UUID da entidade (copiar do cadastro)'],
                            ].map(([campo, obrig, formato]) => (
                                <tr key={campo} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: '#c4a84b' }}>{campo}</td>
                                    <td style={{ padding: '5px 10px', color: obrig === 'Sim' ? '#ef4444' : 'var(--text-muted)' }}>{obrig}</td>
                                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{formato}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Tip>Limite de 500 lancamentos por importacao. Para volumes maiores, divida em varios arquivos.</Tip>
                <Warn>A importacao cria lancamentos direto em Lancamentos, nao em Contas a Pagar. Se precisar criar AP em massa, entre em contato com o suporte tecnico.</Warn>
            </Card>

            {/* ── SECAO 10 ── */}
            <SectionHeader color={SECTION_BLUE} title="10. Comissoes dos corretores" subtitle="Controle completo do ciclo de comissao: calculo, aprovacao e pagamento." />
            <Card title="Ciclo de vida de uma comissao">
                <Step n={1}><strong>Calculada:</strong> comissao criada apos uma venda. O sistema registra o valor bruto e o corretor.</Step>
                <Step n={2}><strong>Aprovada:</strong> gestor revisa e aprova o valor. Pode ajustar se houver desconto ou bonificacao.</Step>
                <Step n={3}><strong>Paga:</strong> apos o pagamento efetivo ao corretor. Registra data e valor pago.</Step>
                <Step n={4}><strong>Estornada / Contestada:</strong> se a venda caiu ou ha disputa, o status muda e a comissao sai dos totais.</Step>
                <Tip>Use o Relatorio por Corretor (Secao 11) para ver o resumo de cada um sem precisar filtrar lancamento por lancamento.</Tip>
            </Card>

            {/* ── SECAO 11 ── */}
            <SectionHeader color={SECTION_GREEN} title="11. Relatorio por Corretor" subtitle="Visao consolidada de producao e comissao de cada um dos 6 corretores." />
            <Card title="Como usar">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    Acesse em <strong>Relatorios → Relatorio Corretores</strong>. Selecione o periodo e clique em <strong>Gerar relatorio</strong>.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    O painel exibe cards de resumo para o time todo: total de comissoes calculadas, pagas, pendentes e volume de vendas gerado.
                    Abaixo, cada corretor aparece em uma linha com seu total de comissao, valor pago e valor pendente.
                </p>
                <Step n={1}>Clique em qualquer corretor para <strong>expandir o detalhe</strong> e ver cada venda individualmente com status, vencimento e data de pagamento.</Step>
                <Step n={2}>Use o filtro de periodo para comparar meses ou ver acumulado do ano.</Step>
                <Tip>Ideal para usar em reunioes mensais com a equipe de vendas ou para calcular bonus.</Tip>
            </Card>

            {/* ── SECAO 12 ── */}
            <SectionHeader color={SECTION_BLUE} title="12. Conciliacao bancaria" subtitle="Confronta o extrato do banco com o que foi lancado no sistema." />
            <Card title="Como usar">
                <Step n={1}>Acesse <strong>Conciliacao e Fechamento → Conciliacao Bancaria</strong>.</Step>
                <Step n={2}>Selecione a conta bancaria e o periodo do extrato.</Step>
                <Step n={3}>O sistema lista os lancamentos nao conciliados. Confirme os que batem com o extrato do banco.</Step>
                <Step n={4}>Lancamentos conciliados ficam marcados e nao aparecem mais como pendentes.</Step>
                <Warn>Nunca feche o mes sem conciliar. Diferenca entre banco e sistema indica lancamento faltando ou valor errado.</Warn>
            </Card>

            {/* ── SECAO 13 ── */}
            <SectionHeader color={SECTION_GOLD} title="13. Fechamento mensal" subtitle="Protege um periodo encerrado para ninguem alterar dados retroativamente." />
            <Card title="Como fechar o mes">
                <Step n={1}>Antes de fechar: certifique-se de que todos os lancamentos do mes foram registrados.</Step>
                <Step n={2}>Confira se ha AP ou AR pendentes que deveriam ter sido quitados no mes.</Step>
                <Step n={3}>Rode a Conciliacao Bancaria e confirme que nao ha diferencas.</Step>
                <Step n={4}>Acesse <strong>Fechamento Mensal</strong>, selecione o mes e clique em <strong>Fechar competencia</strong>.</Step>
                <Step n={5}>Apos fechar, o periodo fica bloqueado. Qualquer tentativa de alterar lancamentos do periodo exibira um aviso.</Step>
                <Tip>Feche o mes sempre ate o dia 5 do mes seguinte, depois de receber o extrato bancario completo.</Tip>
            </Card>

            {/* ── SECAO 14 ── */}
            <SectionHeader color={SECTION_BLUE} title="14. Exportacao contabil" subtitle="Gera arquivo para envio ao escritorio de contabilidade." />
            <Card title="Como exportar">
                <Step n={1}>Acesse <strong>Conciliacao e Fechamento → Exportacao Contabil</strong>.</Step>
                <Step n={2}>Selecione o periodo desejado (recomendado: um mes fechado).</Step>
                <Step n={3}>Clique em <strong>Gerar exportacao</strong>. O sistema monta o arquivo com todos os lancamentos, categorias e valores.</Step>
                <Step n={4}>Baixe o arquivo e envie ao contador.</Step>
                <Tip>Exporte sempre apos fechar o mes. Exportar um periodo aberto pode gerar dados incompletos.</Tip>
            </Card>

            {/* ── SECAO 15 ── */}
            <SectionHeader color={SECTION_GREEN} title="15. DRE Gerencial" subtitle="Demonstrativo de resultado: receitas menos despesas, com margem e detalhamento por categoria." />
            <Card title="Como interpretar o DRE">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    O DRE mostra o resultado financeiro do periodo: quanto entrou, quanto saiu, qual o lucro (ou prejuizo) e a margem percentual.
                    Abaixo do resumo, aparece o detalhamento por categoria de receita e de despesa.
                </p>
                <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, fontSize: '0.82rem', color: '#22c55e' }}>Receitas</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Total de entradas no periodo. Barra verde mostra proporcao por categoria.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, fontSize: '0.82rem', color: '#ef4444' }}>Despesas</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Total de saidas. Barra vermelha mostra qual categoria pesa mais.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, fontSize: '0.82rem', color: '#c4a84b' }}>Resultado</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Verde = lucro. Vermelho = prejuizo. Objetivo: manter sempre positivo.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Margem</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Resultado / Receita em %. Imobiliarias saudaveis ficam acima de 20%.</span>
                    </div>
                </div>
                <Tip>Use o filtro de <strong>Entidade</strong> para ver o DRE apenas da PF ou apenas da PJ. O filtro Consolidado mostra tudo junto.</Tip>
            </Card>

            {/* ── SECAO 16 ── */}
            <SectionHeader color={SECTION_BLUE} title="16. Fluxo de Caixa" subtitle="Mostra o que ja entrou/saiu (realizado) e o que ainda vai entrar/sair (projetado)." />
            <Card title="Como interpretar o Fluxo de Caixa">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: 10 }}>
                    O Fluxo de Caixa tem duas partes: o <strong>realizado</strong> (lancamentos ja pagos/recebidos) e o <strong>projetado</strong>
                    (AP e AR em aberto com vencimento no periodo). A soma dos dois forma o <strong>saldo combinado</strong>.
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 120, fontWeight: 700, fontSize: '0.82rem', color: '#22c55e' }}>Saldo realizado</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>O que efetivamente entrou e saiu do caixa ate hoje.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 120, fontWeight: 700, fontSize: '0.82rem', color: '#f59e0b' }}>Saldo projetado</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>O que deve entrar e sair conforme AP e AR cadastrados.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ minWidth: 120, fontWeight: 700, fontSize: '0.82rem', color: '#c4a84b' }}>Saldo combinado</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Realizado + projetado. Use para decidir se ha caixa para compromissos futuros.</span>
                    </div>
                </div>
                <Tip>Se o saldo combinado ficar negativo em algum mes, e hora de revisar despesas ou antecipar receitas. Use essa informacao com 30 dias de antecedencia.</Tip>
            </Card>

            {/* ── SECAO 17 ── */}
            <SectionHeader color={SECTION_GOLD} title="17. Dashboard — painel principal" subtitle="Visao rapida da saude financeira do periodo selecionado." />
            <Card title="O que cada card significa">
                <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                    {[
                        ['Receitas', 'verde', 'Total de entradas dos lancamentos pagos no periodo.'],
                        ['Despesas', 'vermelho', 'Total de saidas dos lancamentos pagos no periodo.'],
                        ['Saldo', 'verde/vermelho', 'Receitas menos despesas. Positivo = caixa saudavel.'],
                        ['Movimentacao', 'cinza', 'Soma bruta de todos os lancamentos (receitas + despesas).'],
                        ['Vencimentos Proximos', 'alerta', 'Quantidade e valor de contas a pagar vencidas ou vencendo em 3 dias. Se vermelho, atencao urgente.'],
                    ].map(([card, cor, desc]) => (
                        <div key={card as string} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ minWidth: 170, fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{card as string}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{desc as string}</span>
                        </div>
                    ))}
                </div>
                <Tip>Use os graficos abaixo dos cards para identificar tendencias: meses com despesas acima do normal ou categorias que estao crescendo.</Tip>
            </Card>

            {/* ── SECAO 18 ── */}
            <SectionHeader color={SECTION_GREEN} title="18. Exemplos do dia a dia" subtitle="Passos prontos para as situacoes mais comuns na imobiliaria." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <Card title="Pagamento do aluguel do escritorio (despesa recorrente PJ)">
                    <Step n={1}>Acesse Contas a Pagar e verifique se o titulo ja existe. Se sim, clique em Quitar.</Step>
                    <Step n={2}>Se nao existe: va em Novo Lancamento → Tipo despesa → Categoria Aluguel → Entidade PJ → Data do pagamento → Salvar.</Step>
                    <Step n={3}>O valor aparece no DRE da PJ e no Fluxo de Caixa realizado.</Step>
                </Card>
                <Card title="Comissao recebida de venda (receita PJ)">
                    <Step n={1}>Novo Lancamento → Tipo receita → Categoria Comissao → Entidade PJ.</Step>
                    <Step n={2}>Descricao: "Comissao venda Rua X, Apto Y" → valor → data de recebimento → Salvar.</Step>
                    <Step n={3}>Aparece no DRE da PJ como receita de Comissao.</Step>
                </Card>
                <Card title="Pagamento de corretor (despesa PJ)">
                    <Step n={1}>Acesse Comissoes, localize a comissao do corretor, clique em Pagar.</Step>
                    <Step n={2}>O sistema registra a data e o valor pago. Status muda para Pago.</Step>
                    <Step n={3}>Aparece no Relatorio por Corretor com status atualizado.</Step>
                </Card>
                <Card title="Pro-labore do socio (despesa PJ / receita PF)">
                    <Step n={1}>Crie dois lancamentos: um em Despesa (PJ) e um em Receita (PF).</Step>
                    <Step n={2}>Despesa PJ: categoria Pro-labore → favorecido Guilherme Pilger → Entidade PJ.</Step>
                    <Step n={3}>Receita PF: categoria Pro-labore recebido → Entidade PF → mesma data.</Step>
                    <Step n={4}>O DRE da PJ mostra o custo; o DRE da PF mostra a entrada.</Step>
                </Card>
                <Card title="Conta vencida descoberta no dia">
                    <Step n={1}>Abra Contas a Pagar. Procure os badges vermelhos na coluna de vencimento.</Step>
                    <Step n={2}>Avalie qual pagar primeiro com base no valor e no favorecido.</Step>
                    <Step n={3}>Ao pagar: clique em Quitar. Titulo sai da lista de vencidos.</Step>
                    <Step n={4}>Se precisar avisar o time: clique em Enviar Alertas.</Step>
                </Card>
                <Card title="Fechamento do mes (rotina mensal)">
                    <Step n={1}>Dia 1 do mes seguinte: checar se ha AP ou AR pendentes do mes anterior.</Step>
                    <Step n={2}>Rodar Conciliacao Bancaria para confirmar que banco e sistema batem.</Step>
                    <Step n={3}>Ver DRE do mes encerrado para conferir resultado.</Step>
                    <Step n={4}>Fechar competencia em Fechamento Mensal.</Step>
                    <Step n={5}>Gerar Exportacao Contabil e enviar ao contador.</Step>
                </Card>
            </div>

            {/* ── SECAO 19 ── */}
            <SectionHeader color={SECTION_RED} title="19. Guia rapido de decisao" subtitle="Nao sabe onde entrar? Consulte esta tabela." />
            <Card title="Por situacao">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginTop: 4 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Situacao</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Onde ir</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Dinheiro entrou ou saiu hoje', 'Novo Lancamento'],
                                ['Conta com vencimento futuro a pagar', 'Contas a Pagar → criar titulo'],
                                ['Dinheiro a receber de cliente', 'Contas a Receber → criar titulo'],
                                ['Quitar uma conta ja cadastrada', 'Contas a Pagar → Quitar ou Baixa parcial'],
                                ['Ver o que vence esta semana', 'Contas a Pagar → filtro Status = Vencido ou Pendente'],
                                ['Banco diferente do sistema', 'Conciliacao Bancaria'],
                                ['Ver lucro do mes', 'DRE Gerencial → selecionar mes'],
                                ['Ver se ha caixa para proximo mes', 'Fluxo de Caixa'],
                                ['Ver quanto cada corretor produziu', 'Relatorios → Relatorio Corretores'],
                                ['Encerrar o mes', 'Fechamento Mensal → fechar competencia'],
                                ['Enviar dados ao contador', 'Exportacao Contabil'],
                                ['Ver resultado apenas da PJ', 'DRE Gerencial → selecionar Imobiliaria Guilherme Pilger'],
                                ['Ver resultado apenas da PF', 'DRE Gerencial → selecionar Guilherme Pilger'],
                                ['Cadastrar nova categoria', 'Cadastros → Categorias'],
                                ['Adicionar CPF/CNPJ de fornecedor', 'Cadastros → Favorecidos → editar'],
                                ['Importar planilha de lancamentos', 'Contas a Pagar → Importar CSV'],
                            ].map(([situacao, onde]) => (
                                <tr key={situacao as string} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                                    <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{situacao as string}</td>
                                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#c4a84b' }}>{onde as string}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="chart-card" style={{ marginTop: 14, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
                    Duvidas operacionais nao cobertas aqui? Entre em contato com o suporte tecnico antes de fazer lancamentos manuais para corrigir erros — e sempre mais seguro corrigir pela propria tela do sistema.
                </p>
            </div>

        </div>
    )
}
