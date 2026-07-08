export const SELF_ASSESSMENT_VERSION = 'perfil_corretor_ideal_v2_50'

export type SelfAssessmentBlock = 'comportamento' | 'afazeres' | 'evitar'

export type SelfAssessmentQuestion = {
    id: string
    block: SelfAssessmentBlock
    blockLabel: string
    title: string
    prompt: string
    criteria: string[]
}
export type SelfAssessmentAnswer = {
    question_id: string
    score: number
}

export type SelfAssessmentScoredAnswer = SelfAssessmentAnswer & {
    title: string
    block: SelfAssessmentBlock
    block_label: string
    criteria: string[]
}

export type SelfAssessmentBlockScore = {
    block: SelfAssessmentBlock
    label: string
    score: number
    max_score: number
    percentage: number
}

export type SelfAssessmentSummary = {
    version: string
    raw_score: number
    max_score: number
    score_percent: number
    classification_key: string
    classification_label: string
    classification_description: string
    strengths: SelfAssessmentScoredAnswer[]
    improvements: SelfAssessmentScoredAnswer[]
    block_scores: SelfAssessmentBlockScore[]
    answers: SelfAssessmentScoredAnswer[]
}

const BLOCK_LABELS: Record<SelfAssessmentBlock, string> = {
    comportamento: 'Como se comporta',
    afazeres: 'Afazeres',
    evitar: 'O que evitar',
}

function createQuestion(
    id: string,
    block: SelfAssessmentBlock,
    title: string,
    prompt: string,
    criteria: string[],
): SelfAssessmentQuestion {
    return {
        id,
        block,
        blockLabel: BLOCK_LABELS[block],
        title,
        prompt,
        criteria,
    }
}

export const SELF_ASSESSMENT_QUESTIONS: SelfAssessmentQuestion[] = [
    createQuestion('vender', 'comportamento', 'Vender', 'De 0 a 10, como você avalia sua capacidade de transformar oportunidade em venda?', ['Argumentação', 'Necessidade do cliente', 'Conversão']),
    createQuestion('proatividade', 'comportamento', 'Proatividade', 'De 0 a 10, quanto você cria movimento antes de esperar alguém pedir?', ['Iniciativa', 'Velocidade', 'Busca ativa']),
    createQuestion('posicionamento_imagem', 'comportamento', 'Posicionamento e imagem', 'De 0 a 10, como você avalia seu posicionamento, postura e aparência profissional?', ['Imagem', 'Postura', 'Presença']),
    createQuestion('comunicativo', 'comportamento', 'Comunicativo', 'De 0 a 10, como você avalia sua clareza e segurança ao se comunicar?', ['Clareza', 'Confiança', 'Boa conversa']),
    createQuestion('conhecer_mercado', 'comportamento', 'Conhecer o mercado', 'De 0 a 10, quanto você domina preços, regiões, produto e momento do mercado?', ['Região', 'Produto', 'Oportunidade']),
    createQuestion('marketeiro', 'comportamento', 'Marketeiro', 'De 0 a 10, como você usa marketing para gerar autoridade e demanda?', ['Conteúdo', 'Oferta', 'Autoridade']),
    createQuestion('sociavel', 'comportamento', 'Sociável', 'De 0 a 10, como você cria relacionamento com facilidade e naturalidade?', ['Abertura', 'Conexão', 'Relacionamento']),
    createQuestion('escuta_ativa', 'comportamento', 'Escuta ativa', 'De 0 a 10, quanto você escuta antes de tentar vender?', ['Atenção', 'Perguntas', 'Leitura do cliente']),
    createQuestion('disciplinado', 'comportamento', 'Disciplinado', 'De 0 a 10, como você mantém constância mesmo quando não está motivado?', ['Ritual', 'Constância', 'Execução']),
    createQuestion('entender_pessoas', 'comportamento', 'Entender pessoas', 'De 0 a 10, como você identifica perfil, dor, desejo e momento de compra?', ['Perfil', 'Dor', 'Motivação']),
    createQuestion('perfil_comercial_tecnicas', 'comportamento', 'Perfil comercial', 'De 0 a 10, como você avalia seu perfil comercial e uso de técnicas de venda?', ['Técnica', 'Negociação', 'Fechamento']),
    createQuestion('metas_claras', 'comportamento', 'Metas claras', 'De 0 a 10, quanto suas metas são claras, mensuráveis e acompanhadas?', ['Meta', 'Prazo', 'Acompanhamento']),
    createQuestion('resiliencia', 'comportamento', 'Resiliência', 'De 0 a 10, como você reage a recusas, pressão e ciclos difíceis?', ['Reação', 'Persistência', 'Aprendizado']),
    createQuestion('controle_emocional', 'comportamento', 'Controle emocional', 'De 0 a 10, quanto você mantém calma e lucidez nas negociações?', ['Calma', 'Decisão', 'Equilíbrio']),
    createQuestion('networking', 'comportamento', 'Networking', 'De 0 a 10, como você constrói e ativa uma rede de contatos relevante?', ['Rede', 'Parcerias', 'Indicações']),
    createQuestion('influente', 'comportamento', 'Influente', 'De 0 a 10, quanto sua opinião gera confiança e movimento nas pessoas?', ['Confiança', 'Autoridade', 'Persuasão']),
    createQuestion('inovador', 'comportamento', 'Inovador', 'De 0 a 10, quanto você testa novas formas de vender, atender e se posicionar?', ['Teste', 'Criatividade', 'Melhoria']),
    createQuestion('closer', 'comportamento', 'Closer', 'De 0 a 10, como você conduz o cliente para a decisão com segurança?', ['Condução', 'Objeções', 'Decisão']),
    createQuestion('energia_alta', 'comportamento', 'Energia alta', 'De 0 a 10, como você sustenta energia, presença e disposição no dia a dia?', ['Presença', 'Ritmo', 'Entusiasmo']),
    createQuestion('rotina', 'comportamento', 'Rotina', 'De 0 a 10, quanto sua rotina comercial é clara e executada todos os dias?', ['Agenda', 'Prioridade', 'Execução']),
    createQuestion('foco', 'comportamento', 'Foco', 'De 0 a 10, quanto você evita dispersão e mantém atenção no que gera venda?', ['Prioridade', 'Atenção', 'Resultado']),
    createQuestion('visionario', 'comportamento', 'Visionário', 'De 0 a 10, quanto você enxerga oportunidades antes da maioria?', ['Visão', 'Tendência', 'Oportunidade']),
    createQuestion('persistencia', 'comportamento', 'Persistência', 'De 0 a 10, quanto você continua executando mesmo quando o resultado demora?', ['Constância', 'Follow-up', 'Disciplina']),
    createQuestion('conexao', 'comportamento', 'Conexão', 'De 0 a 10, como você cria conexão real com clientes e parceiros?', ['Empatia', 'Presença', 'Confiança']),
    createQuestion('relacionamento', 'comportamento', 'Relacionamento', 'De 0 a 10, como você cultiva relacionamento antes, durante e depois da venda?', ['Pós-venda', 'Contato', 'Fidelização']),
    createQuestion('empreendedor', 'comportamento', 'Empreendedor', 'De 0 a 10, quanto você age como dono do próprio resultado?', ['Autonomia', 'Risco', 'Crescimento']),
    createQuestion('pontual', 'comportamento', 'Pontual', 'De 0 a 10, quanto você cumpre horários, prazos e combinados?', ['Horário', 'Prazo', 'Compromisso']),
    createQuestion('ingles', 'comportamento', 'Inglês', 'De 0 a 10, como você avalia sua capacidade de atender oportunidades em inglês?', ['Comunicação', 'Vocabulário', 'Segurança']),
    createQuestion('crm', 'comportamento', 'CRM', 'De 0 a 10, como você usa CRM para registrar, acompanhar e converter oportunidades?', ['Registro', 'Follow-up', 'Pipeline']),
    createQuestion('gravar_conteudo', 'afazeres', 'Gravar conteúdo', 'De 0 a 10, quanto você grava conteúdo com frequência e intenção comercial?', ['Frequência', 'Clareza', 'Oferta']),
    createQuestion('estudar_mercado', 'afazeres', 'Estudar mercado', 'De 0 a 10, quanto você estuda mercado de forma constante?', ['Dados', 'Regiões', 'Produtos']),
    createQuestion('organizar_informacoes', 'afazeres', 'Organizar informações', 'De 0 a 10, quanto você mantém informações de clientes e imóveis organizadas?', ['Cadastro', 'Histórico', 'Acesso rápido']),
    createQuestion('captar_imoveis', 'afazeres', 'Captar imóveis', 'De 0 a 10, quanto você capta imóveis e oportunidades de forma ativa?', ['Prospecção', 'Parcerias', 'Oferta']),
    createQuestion('visitas_imoveis', 'afazeres', 'Visitas de imóveis', 'De 0 a 10, quanto você visita imóveis para conhecer melhor o produto?', ['Produto', 'Detalhes', 'Argumentos']),
    createQuestion('visitas_construtoras', 'afazeres', 'Visitas às construtoras', 'De 0 a 10, quanto você visita construtoras e fortalece relacionamento com elas?', ['Relacionamento', 'Produto', 'Condições']),
    createQuestion('metodo_cis', 'afazeres', 'Método CIS', 'De 0 a 10, quanto você aplica método para entender comportamento e decisão do cliente?', ['Perfil', 'Perguntas', 'Condução']),
    createQuestion('evita_pessimismo', 'evitar', 'Evita pessimismo', 'De 0 a 10, quanto você evita postura pessimista diante de mercado, cliente e equipe?', ['Solução', 'Responsabilidade', 'Postura']),
    createQuestion('evita_fofoca', 'evitar', 'Evita fofoca', 'De 0 a 10, quanto você evita fofoca e conversas que enfraquecem o ambiente?', ['Discrição', 'Respeito', 'Profissionalismo']),
    createQuestion('nao_subestima_cliente', 'evitar', 'Não subestima cliente', 'De 0 a 10, quanto você evita julgar ou subestimar o potencial de um cliente?', ['Respeito', 'Atenção', 'Leitura']),
    createQuestion('estrategia_atendimento', 'evitar', 'Atende com estratégia', 'De 0 a 10, quanto você evita atendimento improvisado e conduz com estratégia?', ['Plano', 'Perguntas', 'Próximo passo']),
    createQuestion('evita_inseguranca', 'evitar', 'Evita insegurança', 'De 0 a 10, quanto você evita transmitir insegurança em produto, preço e condução?', ['Preparo', 'Confiança', 'Domínio']),
    createQuestion('evita_procrastinar', 'evitar', 'Evita procrastinar', 'De 0 a 10, quanto você evita adiar tarefas comerciais importantes?', ['Ação', 'Prioridade', 'Execução']),
    createQuestion('evita_irresponsabilidade', 'evitar', 'Evita irresponsabilidade', 'De 0 a 10, quanto você evita falhas com combinados, clientes e informações?', ['Cuidado', 'Compromisso', 'Confiabilidade']),
    createQuestion('evita_acomodacao', 'evitar', 'Evita acomodação', 'De 0 a 10, quanto você evita se acomodar quando os resultados estão bons ou ruins?', ['Evolução', 'Movimento', 'Ambição']),
    createQuestion('evita_incoerencia', 'evitar', 'Evita incoerência', 'De 0 a 10, quanto você mantém coerência entre discurso, atitude e entrega?', ['Verdade', 'Consistência', 'Confiança']),
    createQuestion('evita_relaxo', 'evitar', 'Evita relaxo', 'De 0 a 10, quanto você evita relaxar em aparência, atendimento, rotina e entrega?', ['Capricho', 'Padrão', 'Atenção']),
    createQuestion('evita_falta_etica', 'evitar', 'Age com ética', 'De 0 a 10, quanto você evita atalhos e mantém ética em toda negociação?', ['Transparência', 'Respeito', 'Conduta']),
    createQuestion('controle_financeiro', 'evitar', 'Controle financeiro', 'De 0 a 10, quanto você evita descontrole financeiro na vida e na carreira?', ['Planejamento', 'Reserva', 'Gestão']),
    createQuestion('evita_atrasos', 'evitar', 'Evita atrasos', 'De 0 a 10, quanto você evita falta de pontualidade em compromissos e retornos?', ['Pontualidade', 'Retorno', 'Respeito']),
    createQuestion('nao_para_estudar', 'evitar', 'Não para de estudar', 'De 0 a 10, quanto você evita parar de estudar mercado, produto e vendas?', ['Aprendizado', 'Atualização', 'Repertório']),
]

export function clampAssessmentScore(value: unknown) {
    const score = Number(value)
    if (!Number.isFinite(score)) return null
    return Math.max(0, Math.min(10, Math.round(score)))
}

export function classifySelfAssessment(scorePercent: number) {
    if (scorePercent >= 85) {
        return {
            key: 'referencia',
            label: 'Perfil referência',
            description: 'Você se enxerga muito próximo do padrão de corretor ideal.',
        }
    }

    if (scorePercent >= 70) {
        return {
            key: 'alta_performance',
            label: 'Corretor de alta performance',
            description: 'Você já demonstra uma base forte, com pontos específicos para lapidar.',
        }
    }

    if (scorePercent >= 50) {
        return {
            key: 'em_evolucao',
            label: 'Corretor em evolução',
            description: 'Você tem fundamentos importantes e espaço claro para evolução prática.',
        }
    }

    return {
        key: 'em_desenvolvimento',
        label: 'Em desenvolvimento',
        description: 'Seu resultado mostra uma oportunidade de construir base, método e consistência.',
    }
}

export function calculateSelfAssessmentSummary(answers: SelfAssessmentAnswer[]): SelfAssessmentSummary {
    const answerMap = new Map(answers.map(answer => [answer.question_id, answer.score]))

    const scoredAnswers = SELF_ASSESSMENT_QUESTIONS.map((question) => {
        const score = clampAssessmentScore(answerMap.get(question.id)) ?? 0

        return {
            question_id: question.id,
            score,
            title: question.title,
            block: question.block,
            block_label: question.blockLabel,
            criteria: question.criteria,
        }
    })

    const rawScore = scoredAnswers.reduce((total, answer) => total + answer.score, 0)
    const maxScore = SELF_ASSESSMENT_QUESTIONS.length * 10
    const scorePercent = Math.round((rawScore / maxScore) * 100)
    const classification = classifySelfAssessment(scorePercent)

    const blockScores = (Object.keys(BLOCK_LABELS) as SelfAssessmentBlock[]).map((block) => {
        const blockAnswers = scoredAnswers.filter(answer => answer.block === block)
        const score = blockAnswers.reduce((total, answer) => total + answer.score, 0)
        const max = blockAnswers.length * 10

        return {
            block,
            label: BLOCK_LABELS[block],
            score,
            max_score: max,
            percentage: max > 0 ? Math.round((score / max) * 100) : 0,
        }
    })

    return {
        version: SELF_ASSESSMENT_VERSION,
        raw_score: rawScore,
        max_score: maxScore,
        score_percent: scorePercent,
        classification_key: classification.key,
        classification_label: classification.label,
        classification_description: classification.description,
        strengths: [...scoredAnswers].sort((a, b) => b.score - a.score).slice(0, 3),
        improvements: [...scoredAnswers].sort((a, b) => a.score - b.score).slice(0, 3),
        block_scores: blockScores,
        answers: scoredAnswers,
    }
}
