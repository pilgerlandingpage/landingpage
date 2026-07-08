export const SELF_ASSESSMENT_VERSION = 'perfil_corretor_ideal_v1'

export type SelfAssessmentBlock = 'comercial' | 'relacionamento' | 'gestao' | 'mentalidade'

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

export const SELF_ASSESSMENT_QUESTIONS: SelfAssessmentQuestion[] = [
    {
        id: 'venda_fechamento',
        block: 'comercial',
        blockLabel: 'Comercial',
        title: 'Venda e fechamento',
        prompt: 'Como você avalia sua capacidade de conduzir uma venda até o fechamento?',
        criteria: ['Vender', 'Closer', 'Perfil comercial', 'Técnicas comerciais'],
    },
    {
        id: 'proatividade_iniciativa',
        block: 'comercial',
        blockLabel: 'Comercial',
        title: 'Proatividade',
        prompt: 'Como você avalia sua iniciativa para criar oportunidades antes de esperar demanda?',
        criteria: ['Proatividade', 'Captar imóveis', 'Gravar conteúdo', 'Networking'],
    },
    {
        id: 'conhecimento_mercado',
        block: 'comercial',
        blockLabel: 'Comercial',
        title: 'Conhecimento de mercado',
        prompt: 'Como você avalia seu domínio sobre mercado, imóveis, construtoras e oportunidades?',
        criteria: ['Conhecer o mercado', 'Estudar o mercado', 'Visitas de imóveis', 'Visitas de construtoras'],
    },
    {
        id: 'comunicacao_escuta',
        block: 'relacionamento',
        blockLabel: 'Relacionamento',
        title: 'Comunicação e escuta',
        prompt: 'Como você avalia sua comunicação, escuta ativa e conexão com pessoas?',
        criteria: ['Comunicativo', 'Sociável', 'Escuta ativa', 'Conexão'],
    },
    {
        id: 'postura_profissional',
        block: 'relacionamento',
        blockLabel: 'Relacionamento',
        title: 'Postura profissional',
        prompt: 'Como você avalia sua postura, imagem, ética e presença profissional?',
        criteria: ['Posicionamento', 'Aparência', 'Pontualidade', 'Ética', 'Relacionamento'],
    },
    {
        id: 'organizacao_processos',
        block: 'gestao',
        blockLabel: 'Gestão',
        title: 'Organização e processos',
        prompt: 'Como você avalia sua organização de rotina, informações e CRM?',
        criteria: ['Rotina', 'CRM', 'Organizar informações', 'Disciplina'],
    },
    {
        id: 'metas_foco',
        block: 'gestao',
        blockLabel: 'Gestão',
        title: 'Metas e foco',
        prompt: 'Como você avalia sua clareza de metas, foco e persistência no plano comercial?',
        criteria: ['Metas claras', 'Foco', 'Persistência', 'Visão'],
    },
    {
        id: 'inteligencia_emocional',
        block: 'mentalidade',
        blockLabel: 'Mentalidade',
        title: 'Inteligência emocional',
        prompt: 'Como você avalia seu controle emocional, resiliência e segurança nas negociações?',
        criteria: ['Controle emocional', 'Resiliência', 'Segurança', 'Otimismo realista'],
    },
    {
        id: 'energia_presenca',
        block: 'mentalidade',
        blockLabel: 'Mentalidade',
        title: 'Energia e presença',
        prompt: 'Como você avalia sua energia, influência, inovação e atitude empreendedora?',
        criteria: ['Energia alta', 'Influente', 'Inovador', 'Empreendedor'],
    },
    {
        id: 'responsabilidade_consistencia',
        block: 'gestao',
        blockLabel: 'Gestão',
        title: 'Responsabilidade',
        prompt: 'Como você avalia sua consistência para cumprir combinados e evitar procrastinação?',
        criteria: ['Responsabilidade', 'Não procrastinar', 'Não se acomodar', 'Não ser relaxado'],
    },
    {
        id: 'estrategia_atendimento',
        block: 'relacionamento',
        blockLabel: 'Relacionamento',
        title: 'Estratégia no atendimento',
        prompt: 'Como você avalia sua leitura de pessoas e estratégia durante o atendimento?',
        criteria: ['Entender pessoas', 'Não subestimar cliente', 'Método CIS', 'Estratégia no atendimento'],
    },
    {
        id: 'perfil_ideal_sintese',
        block: 'mentalidade',
        blockLabel: 'Mentalidade',
        title: 'Síntese do perfil ideal',
        prompt: 'De 0 a 10, quanto você representa hoje o perfil do corretor ideal?',
        criteria: ['Autopercepção geral', 'Maturidade comercial', 'Potencial de referência'],
    },
]

const BLOCK_LABELS: Record<SelfAssessmentBlock, string> = {
    comercial: 'Comercial',
    relacionamento: 'Relacionamento',
    gestao: 'Gestão',
    mentalidade: 'Mentalidade',
}

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
