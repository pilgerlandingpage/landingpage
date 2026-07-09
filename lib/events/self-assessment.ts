export const SELF_ASSESSMENT_VERSION = 'perfil_corretor_ideal_v4_36'

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
    evitar: 'Pontos de atenção',
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
    createQuestion('marketeiro', 'comportamento', 'Influenciador', 'De 0 a 10, como você usa marketing para gerar autoridade e demanda?', ['Conteúdo', 'Oferta', 'Autoridade']),
    createQuestion('escuta_ativa', 'comportamento', 'Escuta ativa', 'De 0 a 10, quanto você escuta antes de tentar vender?', ['Atenção', 'Perguntas', 'Leitura do cliente']),
    createQuestion('disciplinado', 'comportamento', 'Disciplinado', 'De 0 a 10, como você mantém constância mesmo quando não está motivado?', ['Ritual', 'Constância', 'Execução']),
    createQuestion('entender_pessoas', 'comportamento', 'Entender pessoas', 'De 0 a 10, como você identifica perfil, dor, desejo e momento de compra?', ['Perfil', 'Dor', 'Motivação']),
    createQuestion('metas_claras', 'comportamento', 'Metas claras', 'De 0 a 10, quanto suas metas são claras, mensuráveis e acompanhadas?', ['Meta', 'Prazo', 'Acompanhamento']),
    createQuestion('resiliencia', 'comportamento', 'Resiliência', 'De 0 a 10, como você reage a recusas, pressão e ciclos difíceis?', ['Reação', 'Persistência', 'Aprendizado']),
    createQuestion('controle_emocional', 'comportamento', 'Controle emocional', 'De 0 a 10, quanto você mantém calma e lucidez nas negociações?', ['Calma', 'Decisão', 'Equilíbrio']),
    createQuestion('inovador', 'comportamento', 'Inovador', 'De 0 a 10, quanto você testa novas formas de vender, atender e se posicionar?', ['Teste', 'Criatividade', 'Melhoria']),
    createQuestion('closer', 'comportamento', 'Closer', 'De 0 a 10, como você conduz o cliente para a decisão com segurança?', ['Condução', 'Objeções', 'Decisão']),
    createQuestion('energia_alta', 'comportamento', 'Energia alta', 'De 0 a 10, como você sustenta energia, presença e disposição no dia a dia?', ['Presença', 'Ritmo', 'Entusiasmo']),
    createQuestion('rotina', 'comportamento', 'Rotina', 'De 0 a 10, quanto sua rotina comercial é clara e executada todos os dias?', ['Agenda', 'Prioridade', 'Execução']),
    createQuestion('foco', 'comportamento', 'Foco', 'De 0 a 10, quanto você mantém atenção no que realmente gera venda?', ['Prioridade', 'Atenção', 'Resultado']),
    createQuestion('visionario', 'comportamento', 'Visionário', 'De 0 a 10, quanto você enxerga oportunidades antes da maioria?', ['Visão', 'Tendência', 'Oportunidade']),
    createQuestion('persistencia', 'comportamento', 'Persistência', 'De 0 a 10, quanto você continua executando mesmo quando o resultado demora?', ['Constância', 'Follow-up', 'Disciplina']),
    createQuestion('relacionamento', 'comportamento', 'Relacionamento', 'De 0 a 10, como você cultiva relacionamento antes, durante e depois da venda?', ['Pós-venda', 'Contato', 'Fidelização']),
    createQuestion('empreendedor', 'comportamento', 'Empreendedor', 'De 0 a 10, quanto você age como dono do próprio resultado?', ['Autonomia', 'Risco', 'Crescimento']),
    createQuestion('pontual', 'comportamento', 'Pontual', 'De 0 a 10, quanto você cumpre horários, prazos e combinados?', ['Horário', 'Prazo', 'Compromisso']),
    createQuestion('ingles', 'comportamento', 'Inglês', 'De 0 a 10, como você avalia sua capacidade de atender oportunidades em inglês?', ['Comunicação', 'Vocabulário', 'Segurança']),
    createQuestion('crm', 'comportamento', 'CRM', 'De 0 a 10, como você usa CRM para registrar, acompanhar e converter oportunidades?', ['Registro', 'Follow-up', 'Pipeline']),
    createQuestion('gravar_conteudo', 'afazeres', 'Gravar conteúdo', 'De 0 a 10, quanto você grava conteúdo com frequência e intenção comercial?', ['Frequência', 'Clareza', 'Oferta']),
    createQuestion('captar_imoveis', 'afazeres', 'Captar imóveis', 'De 0 a 10, quanto você capta imóveis e oportunidades de forma ativa?', ['Prospecção', 'Parcerias', 'Oferta']),
    createQuestion('metodo_cis', 'afazeres', 'Método CIS', 'De 0 a 10, quanto você aplica método para entender comportamento e decisão do cliente?', ['Perfil', 'Perguntas', 'Condução']),
    createQuestion('evita_pessimismo', 'evitar', 'Pessimismo', 'De 0 a 10, quanto você mantém postura positiva diante de mercado, cliente e equipe?', ['Solução', 'Responsabilidade', 'Postura']),
    createQuestion('evita_fofoca', 'evitar', 'Fofoca', 'De 0 a 10, quanto você preserva conversas profissionais que fortalecem o ambiente?', ['Discrição', 'Respeito', 'Profissionalismo']),
    createQuestion('nao_subestima_cliente', 'evitar', 'Subestimar cliente', 'De 0 a 10, quanto você respeita o potencial de cada cliente antes de julgar?', ['Respeito', 'Atenção', 'Leitura']),
    createQuestion('estrategia_atendimento', 'evitar', 'Atendimento estratégico', 'De 0 a 10, quanto você conduz o atendimento com estratégia, plano e próximo passo?', ['Plano', 'Perguntas', 'Próximo passo']),
    createQuestion('evita_inseguranca', 'evitar', 'Insegurança', 'De 0 a 10, quanto você transmite segurança sobre produto, preço e condução?', ['Preparo', 'Confiança', 'Domínio']),
    createQuestion('evita_procrastinar', 'evitar', 'Procrastinação', 'De 0 a 10, quanto você executa tarefas comerciais importantes dentro do prazo?', ['Ação', 'Prioridade', 'Execução']),
    createQuestion('evita_irresponsabilidade', 'evitar', 'Irresponsabilidade', 'De 0 a 10, quanto você mantém cuidado com combinados, clientes e informações?', ['Cuidado', 'Compromisso', 'Confiabilidade']),
    createQuestion('evita_falta_etica', 'evitar', 'Ética', 'De 0 a 10, quanto você mantém ética, transparência e respeito em toda negociação?', ['Transparência', 'Respeito', 'Conduta']),
    createQuestion('controle_financeiro', 'evitar', 'Controle financeiro', 'De 0 a 10, quanto você mantém controle financeiro na vida e na carreira?', ['Planejamento', 'Reserva', 'Gestão']),
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
