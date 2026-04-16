// ═══════════════════════════════════════════════════════════════
// Prompt Builder — Converte configurações visuais em system prompt
// ═══════════════════════════════════════════════════════════════

export interface AgentFlowStep {
    id: string
    label: string
    type: 'text' | 'buttons' | 'list' | 'poll' | 'location' | 'transfer'
    instruction: string
    // For buttons
    buttonTitle?: string
    buttonOptions?: string[]
    // For list
    listButtonText?: string
    listSections?: { title: string; items: { name: string; desc?: string }[] }[]
    // For poll
    pollQuestion?: string
    pollOptions?: string[]
    // Transfer message
    transferMessage?: string
}

export interface AgentFlowConfig {
    // Personality
    personality: {
        tone: 'formal' | 'friendly' | 'casual' | 'premium'
        emojiLevel: 'none' | 'low' | 'medium' | 'high'
        messageLength: 'short' | 'medium' | 'long'
        avoidAIPhrases: boolean
        abbreviations: boolean
    }
    // Qualification flow
    steps: AgentFlowStep[]
    // Human behavior
    behavior: {
        responseDelay: 'fast' | 'normal' | 'relaxed'
        workingHours: { enabled: boolean; start: string; end: string; offMessage: string }
        audioChance: number // 0-100% chance of responding with audio
    }
    // Rules
    rules: {
        neverMention: string[]
        alwaysMention: string[]
        maxMessagesBeforeTransfer: number
        autoTransferConditions: {
            allDataCollected: boolean
            clientRequestsHuman: boolean
            clientImpatient: boolean
        }
    }
}

export const DEFAULT_FLOW_CONFIG: AgentFlowConfig = {
    personality: {
        tone: 'friendly',
        emojiLevel: 'medium',
        messageLength: 'short',
        avoidAIPhrases: true,
        abbreviations: false,
    },
    steps: [
        {
            id: 'step_1',
            label: 'Cumprimento',
            type: 'text',
            instruction: 'Cumprimente pelo nome (se souber), pergunte o interesse de forma natural',
        },
        {
            id: 'step_2',
            label: 'Tipo de Interesse',
            type: 'buttons',
            instruction: 'Pergunte se é para morar ou investir',
            buttonTitle: 'O que te traria aqui hoje?',
            buttonOptions: ['Morar', 'Investir', 'Ambos'],
        },
        {
            id: 'step_3',
            label: 'Região',
            type: 'list',
            instruction: 'Ofereça as regiões disponíveis organizadas por área',
            listButtonText: 'Ver regiões',
            listSections: [
                {
                    title: 'Litoral',
                    items: [
                        { name: 'Balneário Camboriú', desc: 'Imóveis de luxo frente mar' },
                        { name: 'Itapema', desc: 'Meia Praia e região' },
                        { name: 'Itajaí', desc: 'Porto e Praia Brava' },
                    ],
                },
                {
                    title: 'Interior',
                    items: [
                        { name: 'Blumenau', desc: 'Capital do Vale' },
                        { name: 'Joinville', desc: 'Maior cidade do estado' },
                    ],
                },
            ],
        },
        {
            id: 'step_4',
            label: 'Orçamento',
            type: 'text',
            instruction: 'Pergunte a faixa de preço de forma sutil e natural, sem parecer robótico',
        },
        {
            id: 'step_5',
            label: 'Transferência',
            type: 'transfer',
            instruction: 'Confirme os dados coletados e transfira para o corretor humano',
            transferMessage: 'Show! Já tenho todas as informações. Vou te passar direto pro corretor que cuida dessa região!',
        },
    ],
    behavior: {
        responseDelay: 'normal',
        workingHours: {
            enabled: false,
            start: '08:00',
            end: '18:00',
            offMessage: 'Oi! No momento estamos fora do horário de atendimento. Retornaremos amanhã às 8h. Deixe sua mensagem que respondemos assim que possível! 😊',
        },
        audioChance: 0,
    },
    rules: {
        neverMention: ['comissão', 'desconto', 'concorrência'],
        alwaysMention: [],
        maxMessagesBeforeTransfer: 8,
        autoTransferConditions: {
            allDataCollected: true,
            clientRequestsHuman: true,
            clientImpatient: true,
        },
    },
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

const TONE_DESCRIPTIONS: Record<string, string> = {
    formal: 'Fale de forma profissional e educada. Use "senhor/senhora" quando apropriado. Evite gírias.',
    friendly: 'Fale de forma amigável e acessível, como um corretor que quer ajudar de verdade. Use primeira pessoa.',
    casual: 'Fale de forma descontraída, como se fosse um amigo indicando um imóvel. Use expressões naturais do WhatsApp.',
    premium: 'Fale de forma sofisticada e elegante, transmitindo exclusividade. Use termos como "experiência", "oportunidade única", "selecionado". Nunca use gírias.',
}

const EMOJI_RULES: Record<string, string> = {
    none: 'NÃO use emojis em nenhuma circunstância.',
    low: 'Use emojis com moderação — no máximo 1 por mensagem e somente para enfatizar algo positivo.',
    medium: 'Use emojis naturalmente, como uma pessoa usaria no WhatsApp (2-3 por mensagem).',
    high: 'Use bastante emojis para parecer animado e entusiasmado! 🏠🔥✨💰',
}

const LENGTH_RULES: Record<string, string> = {
    short: 'Responda em 1 a 2 linhas. Seja direto ao ponto. É WhatsApp, não email.',
    medium: 'Responda em 2 a 3 linhas. Explique brevemente quando necessário.',
    long: 'Responda em 3 a 5 linhas. Dê detalhes relevantes e contexto.',
}

const DELAY_DESCRIPTIONS: Record<string, string> = {
    fast: 'responda rapidamente, como alguém que está com o celular na mão',
    normal: 'responda em um tempo natural, como se estivesse ocupado mas viu a mensagem',
    relaxed: 'responda com calma, como alguém que leu a mensagem e pensou antes de responder',
}

export function buildAgentPrompt(
    config: AgentFlowConfig,
    brokerName: string
): string {
    const lines: string[] = []

    // Identity
    lines.push(`Você é ${brokerName}, corretor de imóveis da Pilger Imóveis.`)
    lines.push('')

    // Tone
    lines.push('ESTILO DE COMUNICAÇÃO:')
    lines.push(`- ${TONE_DESCRIPTIONS[config.personality.tone]}`)
    lines.push(`- ${EMOJI_RULES[config.personality.emojiLevel]}`)
    lines.push(`- ${LENGTH_RULES[config.personality.messageLength]}`)

    if (config.personality.avoidAIPhrases) {
        lines.push('- NUNCA use frases genéricas de IA como: "Como posso ajudá-lo?", "Estou aqui para ajudar!", "Fico feliz em ajudar!", "Não hesite em perguntar". Fale como uma pessoa REAL falaria.')
    }

    if (config.personality.abbreviations) {
        lines.push('- Use abreviações naturais do WhatsApp quando fizer sentido: "vc" (você), "pq" (porque), "tb" (também), "blz" (beleza), "hj" (hoje), "tmb" (também), "qdo" (quando), "q" (que). NÃO exagere — use como uma pessoa normal usaria.')
    }

    lines.push('- NUNCA revele que é IA, agente virtual, chatbot ou robô.')
    lines.push('')

    // Interactive Messages
    lines.push('MENSAGENS INTERATIVAS (use quando indicado no fluxo):')
    lines.push('')
    lines.push('1. BOTÕES — Para perguntas com 2-3 opções claras:')
    lines.push('   [BOTOES:Título|Opção1|Opção2|Opção3]')
    lines.push('')
    lines.push('2. LISTA — Para muitas opções organizadas:')
    lines.push('   [LISTA:Texto do botão|[Seção1]|Item1|Descrição1|Item2|Descrição2|[Seção2]|Item3|Descrição3]')
    lines.push('')
    lines.push('3. ENQUETE — Para pesquisa:')
    lines.push('   [ENQUETE:Pergunta?|Opção1|Opção2|Opção3]')
    lines.push('')
    lines.push('4. LOCALIZAÇÃO — Para pedir localização:')
    lines.push('   [LOCALIZACAO]')
    lines.push('')
    lines.push('5. TRANSFERIR — Quando coltar dados suficientes:')
    lines.push('   [TRANSFERIR]')
    lines.push('')
    lines.push('IMPORTANTE: Nunca envie mais de 1 elemento interativo por mensagem.')
    lines.push('')

    // Flow steps
    lines.push('FLUXO DE QUALIFICAÇÃO (siga esta ordem):')
    config.steps.forEach((step, i) => {
        const num = i + 1
        let stepLine = `${num}. **${step.label}**: ${step.instruction}`

        if (step.type === 'buttons' && step.buttonOptions?.length) {
            const opts = step.buttonOptions.join('|')
            stepLine += `\n   Use: [BOTOES:${step.buttonTitle || step.label}|${opts}]`
        }

        if (step.type === 'list' && step.listSections?.length) {
            const parts = [step.listButtonText || 'Ver opções']
            for (const section of step.listSections) {
                parts.push(`[${section.title}]`)
                for (const item of section.items) {
                    parts.push(item.name)
                    if (item.desc) parts.push(item.desc)
                }
            }
            stepLine += `\n   Use: [LISTA:${parts.join('|')}]`
        }

        if (step.type === 'poll' && step.pollOptions?.length) {
            stepLine += `\n   Use: [ENQUETE:${step.pollQuestion || step.label}|${step.pollOptions.join('|')}]`
        }

        if (step.type === 'location') {
            stepLine += `\n   Use: [LOCALIZACAO]`
        }

        if (step.type === 'transfer') {
            stepLine += `\n   Use: [TRANSFERIR]`
            if (step.transferMessage) {
                stepLine += `\n   Diga algo como: "${step.transferMessage}"`
            }
        }

        lines.push(stepLine)
    })
    lines.push('')

    // Rules
    if (config.rules.neverMention.length > 0) {
        lines.push(`NUNCA fale sobre: ${config.rules.neverMention.join(', ')}`)
    }
    if (config.rules.alwaysMention.length > 0) {
        lines.push(`Quando pertinente, mencione: ${config.rules.alwaysMention.join(', ')}`)
    }
    if (config.rules.maxMessagesBeforeTransfer > 0) {
        lines.push(`Se após ${config.rules.maxMessagesBeforeTransfer} mensagens ainda não conseguiu os dados, transfira mesmo assim.`)
    }

    // Auto transfer
    const transferConditions: string[] = []
    if (config.rules.autoTransferConditions.allDataCollected) {
        transferConditions.push('coletou nome + interesse + orçamento + região')
    }
    if (config.rules.autoTransferConditions.clientRequestsHuman) {
        transferConditions.push('cliente pediu para falar com humano')
    }
    if (config.rules.autoTransferConditions.clientImpatient) {
        transferConditions.push('cliente demonstrou irritação ou impaciência')
    }
    if (transferConditions.length > 0) {
        lines.push(`Transfira automaticamente quando: ${transferConditions.join(' | ')}`)
    }

    // Working hours
    if (config.behavior.workingHours.enabled) {
        lines.push(`\nFora do horário de atendimento (${config.behavior.workingHours.start} às ${config.behavior.workingHours.end}), responda: "${config.behavior.workingHours.offMessage}"`)
    }

    return lines.join('\n')
}
